import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const HOST = "127.0.0.1";
const PORT = 3101;
const BASE_URL = `http://${HOST}:${PORT}`;

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }

  const singleValue = response.headers.get("set-cookie");
  return singleValue ? [singleValue] : [];
}

function extractCookieValue(setCookieHeaders) {
  const sessionCookie = setCookieHeaders.find((header) => header.startsWith("collabspace_session="));
  if (!sessionCookie) {
    return "";
  }

  return sessionCookie.split(";")[0];
}

function createSession() {
  let cookie = "";

  return {
    async request(pathname, options = {}) {
      const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
      };

      if (cookie) {
        headers.Cookie = cookie;
      }

      const response = await fetch(`${BASE_URL}${pathname}`, {
        ...options,
        headers
      });

      const nextCookie = extractCookieValue(getSetCookieHeaders(response));
      if (nextCookie) {
        cookie = nextCookie;
      }

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      return { payload, response };
    }
  };
}

async function waitForServer() {
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the server is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Timed out waiting for the local API server.");
}

test("leader/member flow preserves permissions and current membership identity", async (t) => {
  const server = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT: String(PORT)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let serverOutput = "";
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  t.after(async () => {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  });

  await waitForServer();

  const leader = createSession();
  const member = createSession();
  const leaderEmail = uniqueEmail("leader");
  const memberEmail = uniqueEmail("member");
  const password = "Amrit123!";

  const leaderRegister = await leader.request("/api/auth/register", {
    body: JSON.stringify({
      name: "Leader Example",
      email: leaderEmail,
      password,
      course: "B.Tech",
      year: "3"
    }),
    method: "POST"
  });

  assert.equal(leaderRegister.response.status, 201, serverOutput);
  assert.equal(leaderRegister.payload.user.role, "Member");
  assert.equal(leaderRegister.payload.user.teamName, "");

  const createTeam = await leader.request("/api/team", {
    body: JSON.stringify({
      name: `verify-team-${Date.now()}`,
      projectTitle: "Verification Workspace"
    }),
    method: "POST"
  });

  assert.equal(createTeam.response.status, 201, JSON.stringify(createTeam.payload));
  const team = createTeam.payload.team;
  assert.ok(team?.id);

  const leaderMe = await leader.request("/api/auth/me");
  assert.equal(leaderMe.response.status, 200, JSON.stringify(leaderMe.payload));
  assert.equal(leaderMe.payload.user.role, "Leader");
  assert.equal(leaderMe.payload.user.teamName, team.name);

  const memberRegister = await member.request("/api/auth/register", {
    body: JSON.stringify({
      name: "Member Example",
      email: memberEmail,
      password,
      course: "BBA",
      year: "2"
    }),
    method: "POST"
  });

  assert.equal(memberRegister.response.status, 201, serverOutput);
  assert.equal(memberRegister.payload.user.role, "Member");
  assert.equal(memberRegister.payload.user.teamName, "");

  const invite = await leader.request("/api/team/members", {
    body: JSON.stringify({
      email: memberEmail,
      teamId: team.id
    }),
    method: "POST"
  });

  assert.equal(invite.response.status, 200, JSON.stringify(invite.payload));

  const memberInvites = await member.request("/api/user/invitations");
  assert.equal(memberInvites.response.status, 200);
  assert.equal(memberInvites.payload.invitations.length, 1);
  assert.equal(memberInvites.payload.invitations[0].teamName, team.name);

  const acceptInvite = await member.request("/api/team/invitations/accept", {
    body: JSON.stringify({ teamId: team.id }),
    method: "POST"
  });

  assert.equal(acceptInvite.response.status, 200, JSON.stringify(acceptInvite.payload));

  const memberMe = await member.request("/api/auth/me");
  assert.equal(memberMe.response.status, 200, JSON.stringify(memberMe.payload));
  assert.equal(memberMe.payload.user.teamName, team.name);
  assert.ok(memberMe.payload.user.role);

  const memberTeams = await member.request(`/api/user/teams`);
  assert.equal(memberTeams.response.status, 200, JSON.stringify(memberTeams.payload));
  const joinedTeam = memberTeams.payload.memberTeams.find((candidate) => candidate.id === team.id);
  assert.ok(joinedTeam);
  assert.equal(memberMe.payload.user.role, joinedTeam.role);

  const memberId = memberMe.payload.user.id;
  const leaderId = leaderMe.payload.user.id;

  const memberTaskCreate = await leader.request(`/api/tasks?teamId=${encodeURIComponent(team.id)}`, {
    body: JSON.stringify({
      title: "Member-only task",
      description: "Only the member should own this task.",
      priority: "high",
      assignees: [{ id: memberId, name: "Member Example" }]
    }),
    method: "POST"
  });

  assert.equal(memberTaskCreate.response.status, 201, JSON.stringify(memberTaskCreate.payload));
  assert.deepEqual(memberTaskCreate.payload.task.assignees, [{ id: memberId, name: "Member Example" }]);

  const sharedTaskCreate = await leader.request(`/api/tasks?teamId=${encodeURIComponent(team.id)}`, {
    body: JSON.stringify({
      title: "Shared task",
      description: "Leader and member share this task.",
      priority: "medium",
      assignees: [
        { id: leaderId, name: "Leader Example" },
        { id: memberId, name: "Member Example" }
      ]
    }),
    method: "POST"
  });

  assert.equal(sharedTaskCreate.response.status, 201, JSON.stringify(sharedTaskCreate.payload));
  assert.equal(sharedTaskCreate.payload.task.assignees.length, 2);

  const memberTaskMove = await member.request(
    `/api/tasks/${memberTaskCreate.payload.task.id}?teamId=${encodeURIComponent(team.id)}`,
    {
      body: JSON.stringify({ status: "In Progress", teamId: team.id }),
      method: "PUT"
    }
  );
  assert.equal(memberTaskMove.response.status, 200, JSON.stringify(memberTaskMove.payload));
  assert.equal(memberTaskMove.payload.task.status, "In Progress");

  const sharedTaskMove = await member.request(
    `/api/tasks/${sharedTaskCreate.payload.task.id}?teamId=${encodeURIComponent(team.id)}`,
    {
      body: JSON.stringify({ status: "In Progress", teamId: team.id }),
      method: "PUT"
    }
  );
  assert.equal(sharedTaskMove.response.status, 200, JSON.stringify(sharedTaskMove.payload));
  assert.equal(sharedTaskMove.payload.task.status, "In Progress");

  const memberInviteAttempt = await member.request(`/api/team/members?teamId=${encodeURIComponent(team.id)}`, {
    body: JSON.stringify({ email: uniqueEmail("forbidden"), teamId: team.id }),
    method: "POST"
  });
  assert.equal(memberInviteAttempt.response.status, 403, JSON.stringify(memberInviteAttempt.payload));

  const memberUpdateTeamAttempt = await member.request(`/api/team?teamId=${encodeURIComponent(team.id)}`, {
    body: JSON.stringify({ name: "Forbidden Rename", teamId: team.id }),
    method: "PUT"
  });
  assert.equal(memberUpdateTeamAttempt.response.status, 403, JSON.stringify(memberUpdateTeamAttempt.payload));

  const memberApplyRolesAttempt = await member.request(`/api/team/apply-roles?teamId=${encodeURIComponent(team.id)}`, {
    body: JSON.stringify({
      assignments: [{ userId: memberId, role: "Leader" }],
      teamId: team.id
    }),
    method: "POST"
  });
  assert.equal(memberApplyRolesAttempt.response.status, 403, JSON.stringify(memberApplyRolesAttempt.payload));

  const profileEscalationAttempt = await member.request("/api/users/profile", {
    body: JSON.stringify({
      name: "Member Example",
      role: "Leader",
      course: "BBA"
    }),
    method: "PUT"
  });
  assert.equal(profileEscalationAttempt.response.status, 200, JSON.stringify(profileEscalationAttempt.payload));
  assert.notEqual(profileEscalationAttempt.payload.user.role, "Leader");
});
