import "dotenv/config";
import crypto from "crypto";
import { readFile, stat } from "fs/promises";
import http from "http";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const SESSION_COOKIE = "collabspace_session";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 30;
const SESSION_SECRET =
  process.env.SESSION_SECRET || "collabspace-local-development-secret";
const TASK_ARCHIVE_DELAY_MS = 24 * 60 * 60 * 1000;

// GEMINI INTEGRATION
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-1.5-pro";

function callGemini(promptText) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }]
    });

    const req = https.request(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            if(parsed.error) return reject(new Error(parsed.error.message));
            const txt = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
            resolve(txt.trim());
          } catch(e) { reject(e); }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

const PUBLIC_DIR = path.join(__dirname, "..", "dist");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

/* ── MongoDB Connection ──────────────────────────────── */

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("FATAL: MONGODB_URI environment variable is not set.");
  process.exit(1);
}

const mongoClient = new MongoClient(MONGODB_URI);
let db;

async function connectToDatabase() {
  if (db) return db;
  try {
    await mongoClient.connect();
    db = mongoClient.db("collabspace");
    console.log("✅ Connected to MongoDB Atlas (collabspace)");
    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

// Connect on startup
connectToDatabase();

/* ── Helpers ─────────────────────────────────────────── */

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    ...headers
  });
  res.end(text);
}

async function sendFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const file = await readFile(filePath);

  res.writeHead(200, {
    "Cache-Control": [".html", ".css", ".js"].includes(extension)
      ? "no-store"
      : "public, max-age=300",
    "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
  });
  res.end(file);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

/* ── Cookie / Session ────────────────────────────────── */

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = {};

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.trim().split("=");

    if (!rawName) {
      continue;
    }

    cookies[rawName] = decodeURIComponent(rawValue.join("="));
  }

  return cookies;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  parts.push(`Path=${options.path || "/"}`);
  parts.push(`SameSite=${options.sameSite || "Lax"}`);

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;

      if (size > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch (e) { return {}; }
    }
    return req.body;
  }
  const rawBody = await readRequestBody(req);

  if (!rawBody.trim()) {
    return {};
  }

  return JSON.parse(rawBody);
}

/* ── MongoDB Collection Helpers ──────────────────────── */

async function readUsers() {
  const database = await connectToDatabase();
  const docs = await database.collection("users").find({}).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

async function writeUsers(users) {
  const database = await connectToDatabase();
  const col = database.collection("users");
  await col.deleteMany({});
  if (users.length > 0) {
    await col.insertMany(users);
  }
}

async function readTasks() {
  const database = await connectToDatabase();
  const rawTasks = await database.collection("tasks").find({}).toArray();
  const cleaned = rawTasks.map(({ _id, ...rest }) => rest);
  return cleaned.map((task) => normalizeStoredTask(task));
}

async function writeTasks(tasks) {
  const database = await connectToDatabase();
  const col = database.collection("tasks");
  await col.deleteMany({});
  if (tasks.length > 0) {
    await col.insertMany(tasks);
  }
}

async function readTeams() {
  const database = await connectToDatabase();
  const docs = await database.collection("teams").find({}).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

async function writeTeams(teams) {
  const database = await connectToDatabase();
  const col = database.collection("teams");
  await col.deleteMany({});
  if (teams.length > 0) {
    await col.insertMany(teams);
  }
}

async function readMessages() {
  const database = await connectToDatabase();
  const docs = await database.collection("messages").find({}).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

async function writeMessages(messages) {
  const database = await connectToDatabase();
  const col = database.collection("messages");
  await col.deleteMany({});
  if (messages.length > 0) {
    await col.insertMany(messages);
  }
}

async function appendMessage(message) {
  const database = await connectToDatabase();
  await database.collection("messages").insertOne(message);
}

/* ── Auth helpers ────────────────────────────────────── */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function isLeadRole(role) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "leader" || normalizedRole === "project lead";
}

function isLeadUser(user, team = null) {
  if (!user) {
    return false;
  }

  if (team?.createdBy === user.id) {
    return true;
  }

  if (isLeadRole(user.role)) {
    return true;
  }

  return Boolean(
    team?.members?.some(
      (member) => member.userId === user.id && isLeadRole(member.role)
    )
  );
}

function getRequestedTeamId(req, body = null) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return String(body?.teamId || url.searchParams.get("teamId") || "").trim();
}

function taskBelongsToTeam(task, team) {
  if (!task || !team) {
    return false;
  }

  return task.teamId === team.id || task.teamName === team.name;
}

function isTaskAssignedToUser(task, user) {
  if (!task || !user) {
    return false;
  }

  const assigneeId = String(task.assigneeId || "").trim();
  const assigneeName = String(task.assignee || "").trim();

  return (
    (assigneeId && assigneeId === String(user.id || "").trim()) ||
    (assigneeName && assigneeName === String(user.name || "").trim())
  );
}

function canMoveTask(user, team, task) {
  return isLeadUser(user, team) || isTaskAssignedToUser(task, user);
}

function canEditTask(user, team) {
  return isLeadUser(user, team);
}

function canDeleteTask(user, team) {
  return isLeadUser(user, team);
}

function resolveTaskAssignee(team, assigneeValue, assigneeIdValue) {
  const assignee = String(assigneeValue || "").trim();
  const assigneeId = String(assigneeIdValue || "").trim();
  const members = Array.isArray(team?.members) ? team.members : [];

  if (!assignee && !assigneeId) {
    return { assignee: "", assigneeId: "" };
  }

  const member = assigneeId
    ? members.find((candidate) => candidate.userId === assigneeId)
    : members.find((candidate) => String(candidate.name || "").trim() === assignee);

  if (!member) {
    return null;
  }

  return {
    assignee: String(member.name || "").trim(),
    assigneeId: String(member.userId || "").trim()
  };
}

function normalizeTaskStatus(status) {
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (normalizedStatus === "done" || normalizedStatus === "completed") {
    return "Done";
  }

  if (
    normalizedStatus === "in progress" ||
    normalizedStatus === "in-progress"
  ) {
    return "In Progress";
  }

  return "To Do";
}

function getTaskCompletedAt(task) {
  return String(
    task?.completedAt || task?.doneAt || task?.updatedAt || task?.createdAt || new Date().toISOString()
  ).trim();
}

function isArchivedTask(task) {
  return Boolean(String(task?.archivedAt || "").trim());
}

function isLockedTask(task) {
  return isArchivedTask(task) || normalizeTaskStatus(task?.status) === "Done";
}

function shouldArchiveTask(task, now = Date.now()) {
  if (!task || isArchivedTask(task) || normalizeTaskStatus(task.status) !== "Done") {
    return false;
  }

  const completedTimestamp = Date.parse(getTaskCompletedAt(task));
  if (!Number.isFinite(completedTimestamp)) {
    return false;
  }

  return now - completedTimestamp >= TASK_ARCHIVE_DELAY_MS;
}

function normalizeStoredTask(task, now = Date.now()) {
  const normalizedStatus = normalizeTaskStatus(task?.status);
  const completedAt = normalizedStatus === "Done" || task?.archivedAt
    ? getTaskCompletedAt(task)
    : "";
  const archivedAt = String(
    task?.archivedAt || (
      shouldArchiveTask({ ...task, status: normalizedStatus, completedAt }, now)
        ? new Date(now).toISOString()
        : ""
    )
  ).trim();

  return {
    ...task,
    archivedAt,
    assignee: String(task?.assignee || "").trim(),
    assigneeId: String(task?.assigneeId || "").trim(),
    completedAt,
    comments: Array.isArray(task?.comments) ? task.comments : [],
    deadline: String(task?.deadline || "").trim(),
    description: String(task?.description || "").trim(),
    priority: String(task?.priority || "medium").trim(),
    status: archivedAt ? "Done" : normalizedStatus,
    teamId: String(task?.teamId || "").trim(),
    teamName: String(task?.teamName || "").trim(),
    title: String(task?.title || "").trim(),
    doneAt: undefined
  };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyPassword(password, storedHash) {
  const [salt, savedHash] = String(storedHash || "").split(":");

  if (!salt || !savedHash) {
    return false;
  }

  const currentHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return safeEqualText(savedHash, currentHash);
}

function signSessionPayload(encodedPayload) {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function createSessionToken(user) {
  const payload = {
    email: user.email,
    expiresAt: Date.now() + SESSION_MAX_AGE,
    issuedAt: Date.now(),
    userId: user.id
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );

  return `${encodedPayload}.${signSessionPayload(encodedPayload)}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signSessionPayload(encodedPayload);

  if (!safeEqualText(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );

    if (!payload.userId || payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function publicUser(user) {
  return {
    about: String(user.about || "").trim(),
    course: user.course || "",
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name,
    profileUpdatedAt: user.profileUpdatedAt || "",
    role: user.role,
    skills: Array.isArray(user.skills) ? user.skills : [],
    teamName: user.teamName,
    workFocus: Array.isArray(user.workFocus) ? user.workFocus : [],
    year: user.year || ""
  };
}

function normalizeProfileText(value, maxLength = 480) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeProfileTagList(values, maxItems = 12, maxLength = 32) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];

  for (const rawValue of values) {
    const value = String(rawValue || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);

    if (!value) {
      continue;
    }

    const lookupKey = value.toLowerCase();
    if (seen.has(lookupKey)) {
      continue;
    }

    seen.add(lookupKey);
    normalized.push(value);

    if (normalized.length >= maxItems) {
      break;
    }
  }

  return normalized;
}

async function getAuthenticatedUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  const session = verifySessionToken(token);

  if (!session) {
    return null;
  }

  const users = await readUsers();
  return users.find((user) => user.id === session.userId) || null;
}

function buildSessionCookie(user) {
  return serializeCookie(SESSION_COOKIE, createSessionToken(user), {
    maxAge: SESSION_MAX_AGE
  });
}

function buildExpiredSessionCookie() {
  return serializeCookie(SESSION_COOKIE, "", {
    expires: new Date(0),
    maxAge: 0
  });
}

/* ── Static assets ───────────────────────────────────── */

async function serveStaticAsset(res, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(PUBLIC_DIR, relativePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return false;
  }

  try {
    const fileStats = await stat(filePath);

    if (!fileStats.isFile()) {
      return false;
    }

    await sendFile(res, filePath);
    return true;
  } catch {
    return false;
  }
}

/* ── Auth endpoints ──────────────────────────────────── */

async function handleRegister(req, res) {
  try {
    const body = await readJsonBody(req);
    const name = String(body.name || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const course = String(body.course || "").trim();
    const year = String(body.year || "").trim();

    if (name.length < 2) {
      sendJson(res, 400, { error: "Please enter your full name." });
      return;
    }

    if (!validateEmail(email)) {
      sendJson(res, 400, { error: "Please enter a valid email address." });
      return;
    }

    if (password.length < 8) {
      sendJson(res, 400, {
        error: "Use a password with at least 8 characters."
      });
      return;
    }

    const users = await readUsers();
    const existingUser = users.find((user) => user.email === email);

    if (existingUser) {
      sendJson(res, 409, {
        error: "An account with that email already exists."
      });
      return;
    }

    const user = {
      course,
      createdAt: new Date().toISOString(),
      email,
      id: crypto.randomUUID(),
      name,
      passwordHash: hashPassword(password),
      role: "Member",
      teamName: "",
      year
    };

    users.push(user);
    await writeUsers(users);

    sendJson(
      res,
      201,
      {
        message: "Account created successfully.",
        user: publicUser(user)
      },
      {
        "Set-Cookie": buildSessionCookie(user)
      }
    );
  } catch {
    sendJson(res, 400, { error: "We could not create your account." });
  }
}

async function handleLogin(req, res) {
  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const users = await readUsers();
    const user = users.find((candidate) => candidate.email === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      sendJson(res, 401, { error: "Incorrect email or password." });
      return;
    }

    sendJson(
      res,
      200,
      {
        message: "Welcome back.",
        user: publicUser(user)
      },
      {
        "Set-Cookie": buildSessionCookie(user)
      }
    );
  } catch {
    sendJson(res, 400, { error: "We could not sign you in." });
  }
}

async function handleMe(req, res) {
  const user = await getAuthenticatedUser(req);

  if (!user) {
    sendJson(res, 401, { error: "Not authenticated." });
    return;
  }

  sendJson(res, 200, { user: publicUser(user) });
}

function handleLogout(res) {
  sendJson(
    res,
    200,
    { message: "Signed out successfully." },
    { "Set-Cookie": buildExpiredSessionCookie() }
  );
}

/* ── Task endpoints ──────────────────────────────────── */

async function handleGetTasks(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  const teamId = getRequestedTeamId(req);
  const teams = await readTeams();
  const team = findUserTeam(teams, user.id, teamId);
  if (!team) { sendJson(res, 403, { error: "Access denied or team not found." }); return; }

  const tasks = await readTasks();
  const teamTasks = tasks.filter(
    (task) => taskBelongsToTeam(task, team) && !isArchivedTask(task)
  );
  sendJson(res, 200, { tasks: teamTasks });
}

async function handleGetArchivedTasks(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  const teamId = getRequestedTeamId(req);
  const teams = await readTeams();
  const team = findUserTeam(teams, user.id, teamId);
  if (!team) { sendJson(res, 403, { error: "Access denied or team not found." }); return; }

  const tasks = await readTasks();
  const archivedTasks = tasks
    .filter((task) => taskBelongsToTeam(task, team) && isArchivedTask(task))
    .sort((left, right) => Date.parse(right.archivedAt || 0) - Date.parse(left.archivedAt || 0));

  sendJson(res, 200, { tasks: archivedTasks });
}

async function handleCreateTask(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  try {
    const body = await readJsonBody(req);
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const assignee = String(body.assignee || "").trim();
    const deadline = String(body.deadline || "").trim();
    const priority = String(body.priority || "medium").trim();
    const teamId = getRequestedTeamId(req, body);

    const teams = await readTeams();
    const team = findUserTeam(teams, user.id, teamId);
    if (!team) {
      sendJson(res, 403, { error: "Access denied or team not found." });
      return;
    }

    if (!isLeadUser(user, team)) {
      sendJson(res, 403, { error: "Only the Project Lead can create tasks." });
      return;
    }

    // Keep new tasks in the first board column by default.
    const forcedStatus = "To Do";

    if (!title) {
      sendJson(res, 400, { error: "Task title is required." });
      return;
    }

    const tasks = await readTasks();

    // Auto-assign using AI mechanism based on skills and task content
    let autoAssignee = assignee;
    let autoAssigneeId = String(body.assigneeId || "").trim();

    if (autoAssignee || autoAssigneeId) {
      const resolvedAssignee = resolveTaskAssignee(team, autoAssignee, autoAssigneeId);
      if (!resolvedAssignee) {
        sendJson(res, 400, { error: "Please choose a valid team member." });
        return;
      }

      autoAssignee = resolvedAssignee.assignee;
      autoAssigneeId = resolvedAssignee.assigneeId;
    }
    
    // If an explicit assignee wasn't provided, use AI to find the best match
    if (team && !autoAssignee && !autoAssigneeId) {
      if (!team.members || team.members.length === 0) {
        autoAssignee = user.name;
        autoAssigneeId = user.id;
      } else {
        const teamDataStr = JSON.stringify(team.members.map(m => ({ id: m.userId, name: m.name, role: m.role || "Member" })));
        const prompt = `You are an AI task assigner. 
Task Title: "${title}"
Description: "${description}"
Team Members: ${teamDataStr}

Who is the absolute best single team member to complete this task based on their role and the context of the task? 
Return ONLY their exact ID value. DO NOT output anything else.`;

        try {
          let geminiAssigneeId = await callGemini(prompt);
          geminiAssigneeId = geminiAssigneeId.trim().replace(/^"|"$/g, ''); // strip quotes
          const bestMember = team.members.find(m => m.userId === geminiAssigneeId);
          if (bestMember) {
            autoAssignee = bestMember.name;
            autoAssigneeId = bestMember.userId;
          } else {
             const fallbackMember = team.members.find((m) => isLeadRole(m.role)) || team.members[0];
             autoAssignee = fallbackMember.name;
             autoAssigneeId = fallbackMember.userId;
          }
        } catch(err) {
             console.error("Task Gemini Assignment failed", err);
             const fallbackMember = team.members.find((m) => isLeadRole(m.role)) || team.members[0];
             autoAssignee = fallbackMember.name;
             autoAssigneeId = fallbackMember.userId;
        }
      }
    }

    const task = {
      id: crypto.randomUUID(),
      title,
      description: description || "",
      assignee: autoAssignee || "",
      assigneeId: autoAssigneeId || "",
      archivedAt: "",
      completedAt: "",
      status: forcedStatus,
      deadline,
      priority,
      teamName: team.name || user.teamName || "",
      teamId: team.id || "",
      createdBy: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: []
    };

    tasks.push(task);
    await writeTasks(tasks);
    sendJson(res, 201, { task });
  } catch {
    sendJson(res, 400, { error: "Could not create task." });
  }
}

async function handleUpdateTask(req, res, taskId) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  try {
    const body = await readJsonBody(req);
    const teamId = getRequestedTeamId(req, body);
    const teams = await readTeams();
    const team = findUserTeam(teams, user.id, teamId);
    if (!team) {
      sendJson(res, 403, { error: "Access denied or team not found." });
      return;
    }

    const tasks = await readTasks();
    const taskIndex = tasks.findIndex(
      (task) => task.id === taskId && taskBelongsToTeam(task, team)
    );

    if (taskIndex === -1) {
      sendJson(res, 404, { error: "Task not found." });
      return;
    }

    const task = tasks[taskIndex];
    const currentStatus = normalizeTaskStatus(task.status);
    const isLeader = canEditTask(user, team);
    const isAssignee = isTaskAssignedToUser(task, user);
    const statusWasRequested = body.status !== undefined;
    const requestedStatus = statusWasRequested
      ? normalizeTaskStatus(body.status)
      : null;
    const detailFields = ["title", "description", "assignee", "assigneeId", "deadline", "priority"];
    const hasDetailUpdates = detailFields.some((field) => body[field] !== undefined);

    if (isArchivedTask(task)) {
      sendJson(res, 403, { error: "Archived tasks are read-only." });
      return;
    }

    if (!isLeader) {
      if (hasDetailUpdates) {
        sendJson(res, 403, { error: "Only the project leader can edit task details." });
        return;
      }

      if (!canMoveTask(user, team, task) || !isAssignee) {
        if (statusWasRequested) {
          sendJson(res, 403, { error: "You can only move tasks assigned to you" });
          return;
        }

        sendJson(res, 403, { error: "Only the project leader can edit task details." });
        return;
      }

      if (!statusWasRequested) {
        sendJson(res, 403, { error: "Only the project leader can edit task details." });
        return;
      }
    }

    if (isLeader) {
      if (body.title !== undefined) {
        const nextTitle = String(body.title || "").trim();
        if (!nextTitle) {
          sendJson(res, 400, { error: "Task title is required." });
          return;
        }

        task.title = nextTitle;
      }

      const updatableFields = ["description", "deadline", "priority"];
      for (const field of updatableFields) {
        if (body[field] === undefined) {
          continue;
        }

        task[field] = String(body[field] || "").trim();
      }

      if (body.assignee !== undefined || body.assigneeId !== undefined) {
        const resolvedAssignee = resolveTaskAssignee(team, body.assignee, body.assigneeId);
        if (!resolvedAssignee) {
          sendJson(res, 400, { error: "Please choose a valid team member." });
          return;
        }

        task.assignee = resolvedAssignee.assignee;
        task.assigneeId = resolvedAssignee.assigneeId;
      }
    }

    if (statusWasRequested && requestedStatus !== currentStatus) {
      task.status = requestedStatus;
      task.completedAt = requestedStatus === "Done" ? new Date().toISOString() : "";
      task.archivedAt = "";
    }

    tasks[taskIndex].updatedAt = new Date().toISOString();

    await writeTasks(tasks);
    sendJson(res, 200, { task: normalizeStoredTask(tasks[taskIndex]) });
  } catch {
    sendJson(res, 400, { error: "Could not update task." });
  }
}

async function handleDeleteTask(req, res, taskId) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  const body = await readJsonBody(req);
  const teamId = getRequestedTeamId(req, body);
  const teams = await readTeams();
  const team = findUserTeam(teams, user.id, teamId);
  if (!team) {
    sendJson(res, 403, { error: "Access denied or team not found." });
    return;
  }

  const tasks = await readTasks();
  const taskToDelete = tasks.find(
    (task) => task.id === taskId && taskBelongsToTeam(task, team)
  );

  if (!taskToDelete) {
    sendJson(res, 404, { error: "Task not found." });
    return;
  }

  if (!canDeleteTask(user, team)) {
    sendJson(res, 403, { error: "Only the project leader can delete tasks." });
    return;
  }

  const filtered = tasks.filter((task) => task.id !== taskToDelete.id);

  await writeTasks(filtered);
  sendJson(res, 200, { message: "Task deleted." });
}

/* ── Team endpoints ──────────────────────────────────── */

function findUserTeam(teams, userId, targetTeamId) {
  if (targetTeamId) {
    return teams.find((t) => t.id === targetTeamId && t.members.some((m) => m.userId === userId));
  }
  return teams.find((t) => t.members.some((m) => m.userId === userId));
}

async function handleGetTeam(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const teamId = url.searchParams.get("teamId");

  const teams = await readTeams();
  let team;
  if(teamId) {
     team = teams.find(t => t.id === teamId && t.members.some(m => m.userId === user.id));
  } else {
     team = findUserTeam(teams, user.id); // fallback to original logic if not provided
  }

  if (!team) {
    sendJson(res, 200, { team: null });
    return;
  }

  sendJson(res, 200, { team });
}

async function handleGetUserTeams(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }
  
  const teams = await readTeams();
  const userTeams = teams.filter(t => t.members.some(m => m.userId === user.id));
  
  // Format for the Home Dashboard
  const leaderTeams = [];
  const memberTeams = [];
  
  for(const t of userTeams) {
    const memberObj = t.members.find(m => m.userId === user.id);
    const info = {
      id: t.id,
      name: t.name,
      projectTitle: t.projectTitle || "Unnamed Project",
      role: memberObj.role,
      memberCount: t.members.length,
      joinedAt: memberObj.joinedAt || t.createdAt,
      createdAt: t.createdAt || new Date().toISOString()
    };
    if (t.createdBy === user.id) leaderTeams.push(info);
    else memberTeams.push(info);
  }
  
  console.log(`[API] Returning user ${user.id} - Leaders: ${leaderTeams.length}, Members: ${memberTeams.length}`);
  sendJson(res, 200, { leaderTeams, memberTeams });
}

async function handleCreateTeam(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  try {
    const body = await readJsonBody(req);
    const teamName = String(body.name || "").trim();
    const projectTitle = String(body.projectTitle || "").trim() || `${teamName} Project`;
    const deadline = String(body.deadline || "").trim();

    if (!teamName || teamName.length < 2) {
      sendJson(res, 400, { error: "Team name must be at least 2 characters." });
      return;
    }

    const teams = await readTeams();

    const team = {
      id: crypto.randomUUID(),
      name: teamName,
      createdBy: user.id,
      members: [{ userId: user.id, name: user.name, role: "Leader", joinedAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      projectTitle,
      deadline: deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    teams.push(team);
    await writeTeams(teams);

    // Update user's teamName and role
    const users = await readUsers();
    const userIndex = users.findIndex((u) => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex].teamName = teamName;
      users[userIndex].role = "Leader";
      await writeUsers(users);
    }

    sendJson(res, 201, { team });
  } catch {
    sendJson(res, 400, { error: "Could not create team." });
  }
}

async function handleAddMember(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  try {
    const body = await readJsonBody(req);
    const memberEmail = normalizeEmail(body.email);
    const memberRole = String(body.role || "Member").trim();

    if (!validateEmail(memberEmail)) {
      sendJson(res, 400, { error: "Please enter a valid email address." });
      return;
    }

    const teams = await readTeams();
    const team = findUserTeam(teams, user.id);

    if (!team) {
      sendJson(res, 404, { error: "You are not in a team. Create one first." });
      return;
    }

    // Find the member by email
    const users = await readUsers();
    const memberUser = users.find((u) => u.email === memberEmail);

    if (!memberUser) {
      sendJson(res, 404, { error: "No account found with that email. They need to sign up first." });
      return;
    }

    // Check if already in this team
    if (team.members.some((m) => m.userId === memberUser.id)) {
      sendJson(res, 409, { error: "This person is already in your team." });
      return;
    }

    // Check if in another team
    const otherTeam = findUserTeam(teams, memberUser.id);
    if (otherTeam) {
      sendJson(res, 409, { error: "This person is already in another team." });
      return;
    }

    if (!team.invitations) team.invitations = [];
    
    // Check if already invited
    if (team.invitations.some((i) => i.userId === memberUser.id)) {
      sendJson(res, 409, { error: "This person has already been invited." });
      return;
    }

    // Add to invitations instead of members
    const invitation = {
      userId: memberUser.id,
      name: memberUser.name,
      email: memberUser.email,
      role: "Member", // AI decides exact role later
      invitedAt: new Date().toISOString(),
      invitedBy: user.name
    };
    team.invitations.push(invitation);
    await writeTeams(teams);

    sendJson(res, 200, { team, invitedMember: invitation });
  } catch {
    sendJson(res, 400, { error: "Could not add member." });
  }
}

async function handleGetUserInvitations(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  const teams = await readTeams();
  const invitations = [];

  for (const team of teams) {
    if (team.invitations && team.invitations.some(i => i.userId === user.id)) {
      const invite = team.invitations.find(i => i.userId === user.id);
      invitations.push({
        teamId: team.id,
        teamName: team.name,
        invitedBy: invite.invitedBy,
        invitedAt: invite.invitedAt
      });
    }
  }

  sendJson(res, 200, { invitations });
}

async function handleAcceptInvitation(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  try {
    const body = await readJsonBody(req);
    const teamId = String(body.teamId || "").trim();

    const teams = await readTeams();
    const team = teams.find(t => t.id === teamId);

    if (!team) {
      sendJson(res, 404, { error: "Team not found." });
      return;
    }

    if (!team.invitations || !team.invitations.some(i => i.userId === user.id)) {
      sendJson(res, 404, { error: "Invitation not found." });
      return;
    }



    // Remove from invitations
    team.invitations = team.invitations.filter(i => i.userId !== user.id);

    // Add to members
    team.members.push({
      userId: user.id,
      name: user.name,
      role: "Member",
      joinedAt: new Date().toISOString()
    });

    // Update user's profile
    const users = await readUsers();
    const userIndex = users.findIndex((u) => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex].teamName = team.name;
    }

    // --- AI AUTO-ASSIGNMENT ---
    // Calculate new optimal roles for the entire team now that someone joined
    const suggestions = await suggestRolesForTeam(team.members, users, team.createdBy);
    
    // Save these roles back to the individuals
    for (const assignment of suggestions) {
      const member = team.members.find((m) => m.userId === assignment.userId);
      if (member) member.role = assignment.role;
      
      const uIndex = users.findIndex((u) => u.id === assignment.userId);
      if (uIndex !== -1) users[uIndex].role = assignment.role;
    }

    await writeTeams(teams);
    await writeUsers(users);

    sendJson(res, 200, { message: "Invitation accepted. Roles auto-calibrated." });
  } catch {
    sendJson(res, 400, { error: "Could not accept invitation." });
  }
}

async function handleRejectInvitation(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  try {
    const body = await readJsonBody(req);
    const teamId = String(body.teamId || "").trim();

    const teams = await readTeams();
    const team = teams.find(t => t.id === teamId);

    if (!team) {
      sendJson(res, 404, { error: "Team not found." });
      return;
    }

    if (team.invitations) {
      team.invitations = team.invitations.filter(i => i.userId !== user.id);
      await writeTeams(teams);
    }

    sendJson(res, 200, { message: "Invitation rejected." });
  } catch {
    sendJson(res, 400, { error: "Could not reject invitation." });
  }
}

async function handleUpdateTeam(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  try {
    const body = await readJsonBody(req);
    const teams = await readTeams();
    const team = findUserTeam(teams, user.id);

    if (!team) {
      sendJson(res, 404, { error: "Team not found." });
      return;
    }

    const updatableFields = ["projectTitle", "deadline", "name"];
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        team[field] = body[field];
      }
    }

    await writeTeams(teams);
    sendJson(res, 200, { team });
  } catch {
    sendJson(res, 400, { error: "Could not update team." });
  }
}

/* ── AI Role Suggestion (Powered by Gemini) ─────────────────────────────── */

async function suggestRolesForTeam(members, users, teamCreatorId) {
  const suggestions = [];
  const assignedRoles = new Set();
  
  // Rule: Team creator is ALWAYS the Leader
  assignedRoles.add("Leader");

  const creator = members.find((m) => m.userId === teamCreatorId);
  if (creator) {
    const creatorUser = users.find((u) => u.id === teamCreatorId);
    suggestions.push({
      userId: creator.userId,
      name: creator.name,
      skills: creatorUser && Array.isArray(creatorUser.skills) ? creatorUser.skills : [],
      currentRole: creator.role,
      role: "Leader",
      suggestedRole: "Leader",
      confidence: 100,
      reason: "Team creator — always assigned as Leader.",
      locked: true
    });
  }

  const otherMembers = members.filter((m) => m.userId !== teamCreatorId).map(member => {
    const userRecord = users.find((u) => u.id === member.userId);
    return {
      userId: member.userId,
      name: member.name,
      skills: userRecord && Array.isArray(userRecord.skills) ? userRecord.skills : [],
      currentRole: member.role
    };
  });

  if(otherMembers.length === 0) return suggestions;

  const prompt = `
You are an expert AI software team role assigner. 
The team size (excluding the Leader) is ${otherMembers.length}.
Here is a list of members and their self-reported skills:
${JSON.stringify(otherMembers, null, 2)}

Constraints:
1. Assign meaningful project roles ONLY from this exact list: Developer, Designer, Tester, Project Manager, Researcher.
2. If the team size is 3 or less, you MUST assign up to 2 combined roles per person (e.g. "Developer + Tester").
3. DO NOT use generic roles like "Member". Every single person must be assigned a role.
4. Ensure every member gets at least one valid role. If their skills are empty or junk, intelligently pick whichever role the team is missing most.
5. Provide a brief "reason" string (1 sentence max) explaining the choice.

Output ONLY a raw, valid JSON array of objects representing these assignments, exactly formatting like so, with NO backticks or markdown:
[
  { "userId": "uuid", "role": "Designer", "reason": "Your reason" }
]
`;

  try {
    let geminiResponse = await callGemini(prompt);
    geminiResponse = geminiResponse.replace(/^```(?:json)?|```$/gm, '').trim();
    const parsedAssignments = JSON.parse(geminiResponse);

    for (const member of otherMembers) {
      const assignment = parsedAssignments.find(a => a.userId === member.userId);
      if(assignment && assignment.role) {
        suggestions.push({
          userId: member.userId,
          name: member.name,
          skills: member.skills,
          currentRole: member.currentRole,
          role: assignment.role,
          suggestedRole: assignment.role,
          confidence: 90,
          reason: assignment.reason || "Assigned logically by Gemini AI.",
          locked: false
        });
      } else {
        suggestions.push({
           userId: member.userId,
           name: member.name,
           skills: member.skills,
           currentRole: member.currentRole,
           role: "Developer",
           suggestedRole: "Developer",
           confidence: 10,
           reason: "Fallback assigned by system due to parsing limit.",
           locked: false
        });
      }
    }
  } catch(err) {
    console.error("Gemini Role Check failed, falling back", err);
    for(const member of otherMembers) {
      suggestions.push({
         userId: member.userId,
         name: member.name,
         skills: member.skills,
         currentRole: member.currentRole,
         role: "Developer",
         suggestedRole: "Developer",
         confidence: 10,
         reason: "Connection to Gemini failed, safely defaulted.",
         locked: false
      });
    }
  }
  return suggestions;
}

async function handleSuggestRoles(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  const teams = await readTeams();
  const team = findUserTeam(teams, user.id);

  if (!team) {
    sendJson(res, 404, { error: "You are not in a team." });
    return;
  }

  const users = await readUsers();
  const suggestions = await suggestRolesForTeam(team.members, users, team.createdBy);

  sendJson(res, 200, { suggestions, teamName: team.name });
}

async function handleApplyRoleSuggestions(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  try {
    const body = await readJsonBody(req);
    const assignments = body.assignments; // [{ userId, role }]

    if (!Array.isArray(assignments) || assignments.length === 0) {
      sendJson(res, 400, { error: "No role assignments provided." });
      return;
    }

    const teams = await readTeams();
    const team = findUserTeam(teams, user.id);

    if (!team) {
      sendJson(res, 404, { error: "Team not found." });
      return;
    }

    const users = await readUsers();

    for (const assignment of assignments) {
      const member = team.members.find((m) => m.userId === assignment.userId);
      if (member) {
        member.role = String(assignment.role).trim();
      }

      const userIndex = users.findIndex((u) => u.id === assignment.userId);
      if (userIndex !== -1) {
        users[userIndex].role = String(assignment.role).trim();
      }
    }

    await writeTeams(teams);
    await writeUsers(users);
    sendJson(res, 200, { team, message: "Roles updated successfully." });
  } catch {
    sendJson(res, 400, { error: "Could not apply role suggestions." });
  }
}

/* ── Messages endpoints ──────────────────────────────── */

async function handleGetMessages(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const teamId = url.searchParams.get("teamId");

  const teams = await readTeams();
  const team = findUserTeam(teams, user.id, teamId);
  if (!team) { sendJson(res, 403, { error: "Access denied." }); return; }

  const messages = await readMessages();
  const teamMessages = messages
    .filter((m) => m.teamId === team.id || m.teamName === team.name)
    .slice(-100); // last 100 messages
  sendJson(res, 200, { messages: teamMessages });
}

async function handlePostMessage(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  try {
    const body = await readJsonBody(req);
    const text = String(body.text || "").trim();

    if (!text) {
      sendJson(res, 400, { error: "Message text is required." });
      return;
    }

    const teamId = body.teamId;
    const teams = await readTeams();
    const team = findUserTeam(teams, user.id, teamId);
    if (!team) { sendJson(res, 403, { error: "Access denied." }); return; }

    const message = {
      id: crypto.randomUUID(),
      text,
      teamName: team.name,
      teamId: team.id,
      userId: user.id,
      userName: user.name,
      createdAt: new Date().toISOString()
    };

    await appendMessage(message);
    sendJson(res, 201, { message });
  } catch {
    sendJson(res, 400, { error: "Could not send message." });
  }
}

/* ── Analytics endpoint ──────────────────────────────── */

async function handleGetAnalytics(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const teamId = url.searchParams.get("teamId");

  const teams = await readTeams();
  const team = findUserTeam(teams, user.id, teamId);
  if (!team) { sendJson(res, 403, { error: "Access denied." }); return; }

  const tasks = await readTasks();
  const teamTasks = tasks.filter((t) => t.teamId === team.id || t.teamName === team.name);
  const members = team.members || [];

  const totalTasks = teamTasks.length;
  const completed = teamTasks.filter((t) => normalizeTaskStatus(t.status) === "Done").length;
  const inProgress = teamTasks.filter((t) => normalizeTaskStatus(t.status) === "In Progress").length;
  const todo = teamTasks.filter((t) => normalizeTaskStatus(t.status) === "To Do").length;
  const overdue = teamTasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && normalizeTaskStatus(t.status) !== "Done").length;

  // Contribution per member
  const contributions = {};
  for (const member of members) {
    const memberTasks = teamTasks.filter((t) => t.assignee === member.name || t.assigneeId === member.userId);
    const memberCompleted = memberTasks.filter((t) => normalizeTaskStatus(t.status) === "Done").length;
    contributions[member.name] = {
      total: memberTasks.length,
      completed: memberCompleted,
      percentage: totalTasks > 0 ? Math.round((memberTasks.length / totalTasks) * 100) : 0,
      role: member.role
    };
  }

  const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

  sendJson(res, 200, {
    analytics: {
      totalTasks,
      completed,
      inProgress,
      todo,
      overdue,
      completionRate,
      contributions,
      memberCount: members.length,
      teamName: team.name
    }
  });
}

/* ── Profile update ──────────────────────────────────── */

async function handleUpdateProfile(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) { sendJson(res, 401, { error: "Not authenticated." }); return; }

  try {
    const body = await readJsonBody(req);
    const users = await readUsers();
    const userIndex = users.findIndex((u) => u.id === user.id);

    if (userIndex === -1) {
      sendJson(res, 404, { error: "User not found." });
      return;
    }

    const updatableFields = ["name", "course", "year", "role"];
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        users[userIndex][field] = String(body[field]).trim();
      }
    }

    if (body.about !== undefined) {
      users[userIndex].about = normalizeProfileText(body.about, 560);
    }

    // Handle skills array separately
    if (Array.isArray(body.skills)) {
      users[userIndex].skills = normalizeProfileTagList(body.skills, 15, 36);
    }

    if (Array.isArray(body.workFocus)) {
      users[userIndex].workFocus = normalizeProfileTagList(body.workFocus, 10, 36);
    }

    users[userIndex].profileUpdatedAt = new Date().toISOString();

    await writeUsers(users);
    sendJson(res, 200, { user: publicUser(users[userIndex]) });
  } catch {
    sendJson(res, 400, { error: "Could not update profile." });
  }
}

/* ── Request router ──────────────────────────────────── */

export default async function handler(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const { pathname } = requestUrl;

    // Health check
    if (req.method === "GET" && pathname === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    // Auth routes
    if (req.method === "POST" && pathname === "/api/auth/register") {
      await handleRegister(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/auth/login") {
      await handleLogin(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/auth/me") {
      await handleMe(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/auth/logout") {
      handleLogout(res);
      return;
    }

    // Task routes
    if (req.method === "GET" && pathname === "/api/tasks") {
      await handleGetTasks(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/tasks/archive") {
      await handleGetArchivedTasks(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/tasks") {
      await handleCreateTask(req, res);
      return;
    }

    // Task by ID routes
    const taskMatch = pathname.match(/^\/api\/tasks\/([a-f0-9-]+)$/);
    if (taskMatch) {
      const taskId = taskMatch[1];
      if (req.method === "PUT" || req.method === "PATCH") {
        await handleUpdateTask(req, res, taskId);
        return;
      }
      if (req.method === "DELETE") {
        await handleDeleteTask(req, res, taskId);
        return;
      }
    }

    // Team routes
    if (req.method === "GET" && pathname === "/api/team") {
      await handleGetTeam(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/team") {
      await handleCreateTeam(req, res);
      return;
    }

    if (req.method === "PUT" && pathname === "/api/team") {
      await handleUpdateTeam(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/team/members") {
      await handleAddMember(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/user/teams") {
      await handleGetUserTeams(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/user/invitations") {
      await handleGetUserInvitations(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/team/invitations/accept") {
      await handleAcceptInvitation(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/team/invitations/reject") {
      await handleRejectInvitation(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/team/suggest-roles") {
      await handleSuggestRoles(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/team/apply-roles") {
      await handleApplyRoleSuggestions(req, res);
      return;
    }

    // Messages routes
    if (req.method === "GET" && pathname === "/api/messages") {
      await handleGetMessages(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/messages") {
      await handlePostMessage(req, res);
      return;
    }

    // Analytics
    if (req.method === "GET" && pathname === "/api/analytics") {
      await handleGetAnalytics(req, res);
      return;
    }

    // Profile update
    if (req.method === "PUT" && pathname === "/api/users/profile") {
      await handleUpdateProfile(req, res);
      return;
    }

    // Dashboard and Settings pages are now handled by the React SPA router

    if (req.method === "GET" && pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET") {
      const served = await serveStaticAsset(res, pathname);

      if (served) {
        return;
      }
    }

    if (pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "Route not found." });
      return;
    }

    await sendFile(res, path.join(PUBLIC_DIR, "index.html"));
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error." });
  }
}

/* ── Periodic Role Recalculation ─────────────────────── */

async function recalculateAllRoles() {
  try {
    const teams = await readTeams();
    const users = await readUsers();
    let updated = false;

    for (const team of teams) {
      if (!Array.isArray(team.members) || team.members.length < 2) continue;

      try {
        const suggestions = await suggestRolesForTeam(team.members, users, team.createdBy);
        
        for (const assignment of suggestions) {
          const member = team.members.find((m) => m.userId === assignment.userId);
          if (member) member.role = assignment.role;

          const uIndex = users.findIndex((u) => u.id === assignment.userId);
          if (uIndex !== -1) users[uIndex].role = assignment.role;
        }
        updated = true;
        console.log(`✅ Roles recalculated for team: ${team.name}`);
      } catch (err) {
        console.error(`❌ Role recalculation failed for team ${team.name}:`, err.message);
      }
    }

    if (updated) {
      await writeTeams(teams);
      await writeUsers(users);
    }
  } catch (err) {
    console.error("Periodic role recalculation error:", err);
  }
}

export { recalculateAllRoles };
