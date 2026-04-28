import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request, escapeHtml, formatRelativeTime, initialsFor } from '../utils/api';

export default function HomePage() {
  const navigate = useNavigate();
  const { currentUser: authCurrentUser, logout } = useAuth();

  useEffect(() => {
    if (!authCurrentUser) return;

    let currentUser = authCurrentUser;

    // We'll wrap all the logic from home.js here
    async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  let payload = {};
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeTaskStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();

  if (normalized === "done" || normalized === "completed") {
    return "Done";
  }

  if (normalized === "in progress" || normalized === "in-progress") {
    return "In Progress";
  }

  return "To Do";
}

function normalizeTags(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();
  const tags = [];

  values.forEach((value) => {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }

    const lookupKey = normalized.toLowerCase();
    if (seen.has(lookupKey)) {
      return;
    }

    seen.add(lookupKey);
    tags.push(normalized);
  });

  return tags;
}

function inferRole(user) {
  if (user.role) {
    return user.role;
  }

  const skills = normalizeTags(user.skills);
  if (skills.some((skill) => skill.toLowerCase().includes("design"))) {
    return "Designer";
  }
  if (skills.some((skill) => skill.toLowerCase().includes("test"))) {
    return "Tester";
  }
  if (skills.some((skill) => skill.toLowerCase().includes("manage"))) {
    return "Project Manager";
  }
  if (skills.length > 0) {
    return "Developer";
  }

  return "Member";
}

function deriveFocusAreas(user) {
  const explicitFocus = normalizeTags(user.workFocus);
  if (explicitFocus.length > 0) {
    return explicitFocus;
  }

  const derived = [];
  const skills = normalizeTags(user.skills);

  skills.forEach((skill) => {
    const lowerSkill = skill.toLowerCase();
    if (
      (lowerSkill.includes("react") || lowerSkill.includes("ui") || lowerSkill.includes("figma")) &&
      !derived.includes("Frontend")
    ) {
      derived.push("Frontend");
    }
    if (
      (lowerSkill.includes("node") || lowerSkill.includes("api") || lowerSkill.includes("python")) &&
      !derived.includes("Backend")
    ) {
      derived.push("Backend");
    }
    if (
      (lowerSkill.includes("design") || lowerSkill.includes("wireframe")) &&
      !derived.includes("Design")
    ) {
      derived.push("Design");
    }
    if (
      (lowerSkill.includes("research") || lowerSkill.includes("machine learning")) &&
      !derived.includes("Research")
    ) {
      derived.push("Research");
    }
    if (lowerSkill.includes("test") && !derived.includes("QA")) {
      derived.push("QA");
    }
  });

  if (derived.length === 0) {
    derived.push("Collaboration");
  }

  return derived.slice(0, 6);
}

function getDefaultAbout(user) {
  const firstName = String(user.name || "This teammate").trim().split(/\s+/)[0] || "This teammate";
  const focusAreas = deriveFocusAreas(user).slice(0, 2);
  const focusLabel = focusAreas.length > 0 ? focusAreas.join(" and ").toLowerCase() : "collaborative project work";
  return `${firstName} enjoys contributing to ${focusLabel} and working closely with the team to keep projects moving forward.`;
}

function formatRelativeTime(dateValue) {
  const timestamp = Date.parse(dateValue || "");
  if (!Number.isFinite(timestamp)) {
    return "Recently";
  }

  const diffMs = Math.max(Date.now() - timestamp, 0);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.round(diffMs / minute));
    return `${minutes}m ago`;
  }

  if (diffMs < day) {
    const hours = Math.max(1, Math.round(diffMs / hour));
    return `${hours}h ago`;
  }

  const days = Math.max(1, Math.round(diffMs / day));
  return `${days}d ago`;
}

function renderTagBadges(containerId, tags, emptyLabel) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const safeTags = normalizeTags(tags);
  if (safeTags.length === 0) {
    container.innerHTML = `<span class="skill-tag skill-tag-empty">${escapeHtml(emptyLabel)}</span>`;
    return;
  }

  container.innerHTML = safeTags
    .map((tag) => `<span class="skill-tag">${escapeHtml(tag)}</span>`)
    .join("");
}

function renderStaticProfile(user) {
  const safeUser = user || {};
  const safeRole = inferRole(safeUser);
  const safeAbout = String(safeUser.about || "").trim() || getDefaultAbout(safeUser);

  document.getElementById("user-greeting").textContent = safeUser.name
    ? `Hey, ${safeUser.name.split(" ")[0]}!`
    : "Hey there!";
  document.getElementById("p-avatar").textContent = safeUser.name
    ? safeUser.name.charAt(0).toUpperCase()
    : "?";
  document.getElementById("p-name").textContent = safeUser.name || "User Name";
  document.getElementById("p-role").textContent = safeRole;
  document.getElementById("p-course").textContent = safeUser.course || "Course not added yet";
  document.getElementById("p-about").textContent = safeAbout;

  renderTagBadges("p-skills", safeUser.skills, "Add your strengths in settings");
  renderTagBadges("p-work-focus", deriveFocusAreas(safeUser), "Add your focus areas in settings");
}

function isTaskAssignedToUser(task, user) {
  if (!task || !user) {
    return false;
  }

  if (Array.isArray(task.assignees) && task.assignees.some((assignee) => assignee?.id === user.id)) {
    return true;
  }

  return task.assigneeId === user.id || task.assignee === user.name;
}

function buildProjectStats(projects, tasks) {
  const completedTasks = tasks.filter((task) => {
    const isAssignee = isTaskAssignedToUser(task, currentUser);
    return isAssignee && (normalizeTaskStatus(task.status) === "Done" || String(task.archivedAt || "").trim());
  }).length;

  const contributions = new Set(
    tasks
      .filter((task) => {
        const isCreator = task.createdBy === currentUser.id;
        const isAssignee = isTaskAssignedToUser(task, currentUser);
        return isCreator || isAssignee;
      })
      .map((task) => task.id)
  ).size;

  return [
    { label: "Projects", value: projects.length },
    { label: "Tasks Completed", value: completedTasks },
    { label: "Contributions", value: contributions }
  ];
}

function renderProfileStats(projects, tasks) {
  const container = document.getElementById("p-stats");
  if (!container) {
    return;
  }

  const stats = buildProjectStats(projects, tasks);
  container.innerHTML = stats.map((stat) => `
    <div class="profile-stat-card">
      <span class="profile-stat-value">${escapeHtml(stat.value)}</span>
      <span class="profile-stat-label">${escapeHtml(stat.label)}</span>
    </div>
  `).join("");
}

function renderProjectInvolvement(projects) {
  const container = document.getElementById("p-projects");
  if (!container) {
    return;
  }

  if (!Array.isArray(projects) || projects.length === 0) {
    container.innerHTML = `<div class="team-empty">No active projects yet.</div>`;
    return;
  }

  container.innerHTML = projects.map((project) => `
    <div class="profile-project-item" data-team-id="${escapeHtml(project.id)}">
      <div class="profile-project-copy">
        <strong class="profile-project-title">${escapeHtml(project.projectTitle || project.name || "Untitled Project")}</strong>
        <span class="profile-project-meta">${escapeHtml(project.name || "Workspace")} • ${escapeHtml(project.memberCount)} members</span>
      </div>
      <span class="profile-project-role">${escapeHtml(project.role || "Member")}</span>
    </div>
  `).join("");
}

function taskBelongsToProject(task, project) {
  if (!task || !project) {
    return false;
  }

  return task.teamId === project.id || (!task.teamId && task.teamName === project.name);
}

function isUserTask(task) {
  return isTaskAssignedToUser(task, currentUser);
}

function isCompletedTask(task) {
  return (
    normalizeTaskStatus(task.status) === "Done" ||
    Boolean(String(task.archivedAt || "").trim()) ||
    Boolean(String(task.completedAt || "").trim())
  );
}

function buildContributionEntries(projects, tasks) {
  return projects.map((project) => {
    const projectTasks = tasks.filter((task) => taskBelongsToProject(task, project));
    const completedByUser = projectTasks.filter((task) => isUserTask(task) && isCompletedTask(task)).length;
    const totalTasks = projectTasks.length;
    const contributionPercentage = totalTasks > 0
      ? Math.round((completedByUser / totalTasks) * 100)
      : 0;

    return {
      completedByUser,
      contributionPercentage,
      project,
      totalTasks
    };
  });
}

function renderProjectContributions(projects, tasks) {
  const container = document.getElementById("p-contributions");
  if (!container) {
    return;
  }

  if (!Array.isArray(projects) || projects.length === 0) {
    container.innerHTML = `<div class="team-empty">Contribution details will appear once you join a project.</div>`;
    return;
  }

  const entries = buildContributionEntries(projects, tasks);

  container.innerHTML = entries.map(({ completedByUser, contributionPercentage, project, totalTasks }) => `
    <article class="contribution-card">
      <div class="contribution-card-header">
        <div class="contribution-card-copy">
          <h3 class="contribution-card-title">${escapeHtml(project.projectTitle || project.name || "Untitled Project")}</h3>
          <p class="contribution-card-subtitle">${escapeHtml(project.name || "Workspace")}</p>
        </div>
        <span class="profile-project-role">${escapeHtml(project.role || "Member")}</span>
      </div>

      <div class="contribution-card-stats">
        <span class="contribution-card-ratio">${escapeHtml(completedByUser)} / ${escapeHtml(totalTasks)} tasks completed</span>
        <span class="contribution-card-percentage">${escapeHtml(contributionPercentage)}%</span>
      </div>

      <div class="contribution-progress-track" aria-hidden="true">
        <div class="contribution-progress-fill" style="width: ${Math.min(Math.max(contributionPercentage, 0), 100)}%;"></div>
      </div>
    </article>
  `).join("");
}

function buildActivityEvents(projects, tasks, user) {
  const events = [];
  const taskEventIds = new Set();

  if (user.profileUpdatedAt) {
    events.push({
      timestamp: user.profileUpdatedAt,
      title: "Updated profile",
      description: "Refreshed profile details, interests, or work focus."
    });
  }

  projects.forEach((project) => {
    const isLeader = String(project.role || "").toLowerCase().includes("leader");
    events.push({
      timestamp: project.joinedAt || project.createdAt,
      title: isLeader ? "Started project" : "Joined project",
      description: `${isLeader ? "Leading" : "Contributing to"} ${project.projectTitle || project.name}`
    });
  });

  tasks.forEach((task) => {
    const taskKey = String(task.id || "");
    const isCreator = task.createdBy === user.id;
    const isAssignee = isTaskAssignedToUser(task, user);

    if (isAssignee && task.completedAt && !taskEventIds.has(`${taskKey}:completed`)) {
      taskEventIds.add(`${taskKey}:completed`);
      events.push({
        timestamp: task.completedAt,
        title: "Completed task",
        description: `${task.title || "Untitled task"} in ${task.teamName || "your workspace"}`
      });
    }

    if (isCreator && task.createdAt && !taskEventIds.has(`${taskKey}:created`)) {
      taskEventIds.add(`${taskKey}:created`);
      events.push({
        timestamp: task.createdAt,
        title: "Created task",
        description: `${task.title || "Untitled task"} for ${task.teamName || "your workspace"}`
      });
    }
  });

  return events
    .filter((event) => Number.isFinite(Date.parse(event.timestamp || "")))
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 6);
}

function renderActivity(projects, tasks, user) {
  const container = document.getElementById("p-activity");
  if (!container) {
    return;
  }

  const events = buildActivityEvents(projects, tasks, user);
  if (events.length === 0) {
    container.innerHTML = `<div class="team-empty">No recent workspace activity.</div>`;
    return;
  }

  container.innerHTML = events.map((event) => `
    <div class="activity-item">
      <div class="activity-marker"></div>
      <div class="activity-copy">
        <div class="activity-time">${escapeHtml(formatRelativeTime(event.timestamp))}</div>
        <div class="activity-desc">
          <strong>${escapeHtml(event.title)}</strong>
          <span>${escapeHtml(event.description)}</span>
        </div>
      </div>
    </div>
  `).join("");
}

function generateCard(team, isLeader) {
  return `
    <div class="project-card ${isLeader ? "p-leader" : ""}" data-team-id="${escapeHtml(team.id)}">
      <h4 class="p-title">${escapeHtml(team.projectTitle || "Untitled Project")}</h4>
      <div class="p-desc">Team: ${escapeHtml(team.name || "Workspace")} &bull; ${escapeHtml(team.memberCount)} members</div>
      <div class="p-footer">
        <span class="p-role">${escapeHtml(team.role || "Member")}</span>
        <span class="arrow-icon">&rarr;</span>
      </div>
    </div>
  `;
}

async function loadAllTasksForProjects(projects) {
  const settledResults = await Promise.allSettled(
    projects.map(async (project) => {
      const teamId = encodeURIComponent(project.id);
      const [activePayload, archivedPayload] = await Promise.all([
        request(`/api/tasks?teamId=${teamId}`, { method: "GET" }),
        request(`/api/tasks/archive?teamId=${teamId}`, { method: "GET" })
      ]);

      return [
        ...(Array.isArray(activePayload.tasks) ? activePayload.tasks : []),
        ...(Array.isArray(archivedPayload.tasks) ? archivedPayload.tasks : [])
      ];
    })
  );

  const mergedTasks = settledResults
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value || []);

  const seenTaskIds = new Set();
  return mergedTasks.filter((task) => {
    const taskId = String(task.id || "");
    if (!taskId) {
      return false;
    }

    if (seenTaskIds.has(taskId)) {
      return false;
    }

    seenTaskIds.add(taskId);
    return true;
  });
}

async function bootstrap() {
  try {

    const urlParams = new URLSearchParams(window.location.search);
    const requestedView = urlParams.get("view");
    renderStaticProfile(currentUser);
    switchView(requestedView === "profile" ? "profile" : "projects");

    await loadProjects();
    await checkInvitations();
  } catch (err) {
    console.error(err);
    navigate("/index.html");
  }
}

async function checkInvitations() {
  try {
    const res = await request("/api/user/invitations", { method: "GET" });
    const invites = res.invitations || [];
    const btn = document.getElementById("nav-invites-btn");
    const container = document.getElementById("invites-content");
    const modal = document.getElementById("invites-modal");
    
    if(btn && invites.length > 0) {
      btn.style.display = "inline-flex";
      btn.textContent = `Invites (${invites.length})`;
      btn.style.color = "var(--warning)";
      btn.onclick = () => modal.showModal();
      
      container.innerHTML = invites.map(i => `
        <div class="invite-card">
          <div class="invite-title">${escapeHtml(i.teamName)}</div>
          <div class="invite-subtitle">Invited by ${escapeHtml(i.invitedByName)}</div>
          <div class="invite-actions">
            <button class="btn btn-primary" data-invite-action="accept" data-team-id="${escapeHtml(i.teamId)}">Accept</button>
            <button class="btn btn-ghost" data-invite-action="reject" data-team-id="${escapeHtml(i.teamId)}">Reject</button>
          </div>
        </div>
      `).join('');
    } else if(btn) {
      btn.style.display = "none";
      if(modal.open) modal.close();
    }
  } catch(e) { }
}

async function acceptInvite(teamId) {
  try {
    await request("/api/team/invitations/accept", { method: "POST", body: JSON.stringify({ teamId }) });
    window.location.reload();
  } catch(e) { alert("Failed to accept"); }
}

async function rejectInvite(teamId) {
  try {
    await request("/api/team/invitations/reject", { method: "POST", body: JSON.stringify({ teamId }) });
    checkInvitations();
  } catch(e) { alert("Failed to reject"); }
}

async function loadProjects() {
  try {
    const payload = await request("/api/user/teams");
    const leaderTeams = Array.isArray(payload.leaderTeams) ? payload.leaderTeams : [];
    const memberTeams = Array.isArray(payload.memberTeams) ? payload.memberTeams : [];
    const allProjects = [...leaderTeams, ...memberTeams];

    const leaderGrid = document.getElementById("leader-grid");
    const memberGrid = document.getElementById("member-grid");

    if (leaderTeams.length === 0) {
      leaderGrid.innerHTML = `
        <div class="empty-state">
          <h4 class="empty-state-title">No enterprise projects</h4>
          <p class="empty-state-desc">You haven't initialized any workspace environments.</p>
          <button onclick="document.getElementById('create-project-modal').showModal()" class="btn btn-primary">+ Initialize Workspace</button>
        </div>`;
    } else {
      leaderGrid.innerHTML = leaderTeams.map((team) => generateCard(team, true)).join("");
    }

    if (memberTeams.length === 0) {
      memberGrid.innerHTML = `
        <div class="empty-state">
          <h4 class="empty-state-title">No collaborations joined</h4>
          <p class="empty-state-desc">Wait for an invite or create a workspace of your own.</p>
        </div>`;
    } else {
      memberGrid.innerHTML = memberTeams.map((team) => generateCard(team, false)).join("");
    }

    const allTasks = await loadAllTasksForProjects(allProjects);
    renderProfileStats(allProjects, allTasks);
    renderProjectInvolvement(allProjects);
    renderProjectContributions(allProjects, allTasks);
    renderActivity(allProjects, allTasks, currentUser);
  } catch (error) {
    console.error("Failed to load projects", error);
    const crashView = document.createElement("div");
    crashView.className = "debug-crash";
    crashView.innerHTML = `<h3>CRITICAL JS CRASH</h3>${escapeHtml(error.message)}<br><br>${escapeHtml(error.stack || "")}`;
    document.body.appendChild(crashView);
  }
}

function switchView(viewId) {
  document.getElementById("view-profile").classList.remove("active");
  document.getElementById("view-projects").classList.remove("active");
  document.getElementById("nav-btn-profile").classList.remove("active");
  document.getElementById("nav-btn-projects").classList.remove("active");

  if (viewId === "profile") {
    document.getElementById("view-profile").classList.add("active");
    document.getElementById("nav-btn-profile").classList.add("active");
  } else {
    document.getElementById("view-projects").classList.add("active");
    document.getElementById("nav-btn-projects").classList.add("active");
  }
}

async function logout() {
  try {
    await request("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
  } catch (error) {
    console.error("Logout failed", error);
  }
  navigate("/index.html");
}

  const form = document.getElementById("create-project-form");
  if (form) {
    // Ensure we don't attach multiple listeners if useEffect runs multiple times
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = document.getElementById("cp-name").value.trim();
      const projectTitle = document.getElementById("cp-title").value.trim();
      if (!name) {
        return;
      }

      try {
        await request("/api/team", {
          method: "POST",
          body: JSON.stringify({ name, projectTitle })
        });
        document.getElementById("create-project-modal").close();
        document.getElementById("cp-name").value = "";
        document.getElementById("cp-title").value = "";
        await loadProjects();
      } catch (error) {
        alert("Failed to create workspace. " + error.message);
      }
    });
  }





    
    // Unified global click handler
    const handleGlobalClick = async (e) => {
      const target = e.target.closest('[data-navigate], [data-action], [data-invite-action], .project-card, .profile-project-item');
      if (!target) return;

      if ((target.classList.contains('project-card') || target.classList.contains('profile-project-item')) && target.dataset.teamId) {
        navigate('/dashboard?teamId=' + encodeURIComponent(target.dataset.teamId));
      } else if (target.dataset.inviteAction && target.dataset.teamId) {
        if (target.dataset.inviteAction === "accept") {
          await acceptInvite(target.dataset.teamId);
        } else if (target.dataset.inviteAction === "reject") {
          await rejectInvite(target.dataset.teamId);
        }
      } else if (target.dataset.navigate) {
        navigate(target.dataset.navigate.replace('.html', ''));
      } else if (target.dataset.action === 'switchView') {
        switchView(target.dataset.viewArgs);
      } else if (target.dataset.action === 'logout') {
        logout().then(() => navigate('/'));
      }
    };
    
    document.addEventListener('click', handleGlobalClick);

    // Call bootstrap
    bootstrap();

    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [authCurrentUser, navigate, logout]);

  // Provide a clean way to handle clicks that were previously inline onclicks
  const handleStaticClick = (e) => {
     const action = e.currentTarget.dataset.action;
     if (action === 'navigate') {
       navigate(e.currentTarget.dataset.href.replace('.html', ''));
     }
  };

  return (
    <>
      


  <div className="app-layout">
    
    
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand" data-navigate="/">
          <div className="brand-mark">C</div>
          CollabSpace
        </div>
      </div>
      
      <nav className="sidebar-nav">
        <button id="nav-btn-projects" className="sidebar-nav-item active" data-action="switchView" data-view-args="projects">
          <span>Workspace Hub</span>
        </button>
        <button id="nav-invites-btn" className="sidebar-nav-item" style={{display: 'none'}}>Invites (0)</button>
        <button id="nav-btn-profile" className="sidebar-nav-item" data-action="switchView" data-view-args="profile">
          <span>Profile</span>
        </button>
      </nav>
      
      <div className="sidebar-footer">
        <span id="user-greeting" className="project-context-subtitle" >Loading...</span>
        <button data-navigate="/settings.html" className="sidebar-nav-item">Edit Profile</button>
        <button data-action="logout" className="sidebar-nav-item">Sign Out</button>
      </div>
    </aside>

    <main className="app-main">
      
      
      <section id="view-profile" className="view-section">
        <div className="app-main-header">
          <h1 className="app-main-title">Profile Portal</h1>
          <p className="app-main-subtitle">See your strengths, current projects, and the work you’ve been driving lately.</p>
        </div>
        <div className="profile-card">
          <div className="profile-header">
            <div id="p-avatar" className="avatar-circle">?</div>
            <div className="profile-header-copy">
              <h2 id="p-name" className="profile-name">User Name</h2>
              <div className="profile-meta-row">
                <div id="p-role" className="profile-role-badge">Member</div>
                <div id="p-course" className="profile-meta-chip">Course not added yet</div>
              </div>
            </div>
          </div>

          <div className="profile-stats-grid" id="p-stats">
            <div className="profile-stat-card">
              <span className="profile-stat-value">0</span>
              <span className="profile-stat-label">Projects</span>
            </div>
            <div className="profile-stat-card">
              <span className="profile-stat-value">0</span>
              <span className="profile-stat-label">Tasks Completed</span>
            </div>
            <div className="profile-stat-card">
              <span className="profile-stat-value">0</span>
              <span className="profile-stat-label">Contributions</span>
            </div>
          </div>

          <div className="profile-block">
            <div className="profile-section-title">About You</div>
            <p id="p-about" className="bio-text">Passionate about building projects and collaborating with teams to deliver excellent digital experiences.</p>
          </div>

          <div className="profile-insights-grid">
            <div className="profile-block">
              <div className="profile-section-title">Skills & Interests</div>
              <div id="p-skills" className="skills-list"></div>
            </div>

            <div className="profile-block">
              <div className="profile-section-title">What I Usually Work On</div>
              <div id="p-work-focus" className="skills-list"></div>
            </div>
          </div>

          <div className="profile-block">
            <div className="profile-section-title">Projects Involved</div>
            <div id="p-projects" className="profile-projects-list">
              <div className="team-empty">No active projects yet.</div>
            </div>
          </div>

          <div className="profile-block">
            <div className="profile-section-title">Project Contributions</div>
            <div id="p-contributions" className="profile-contributions-list">
              <div className="team-empty">Contribution details will appear once you join a project.</div>
            </div>
          </div>

          <div className="profile-block">
            <div className="profile-section-title">Recent Activity</div>
            <div className="activity-container" id="p-activity">
              <div className="activity-item">
                <div className="activity-marker"></div>
                <div className="activity-copy">
                  <div className="activity-time">2h ago</div>
                  <div className="activity-desc">Updated profile settings</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      
      <section id="view-projects" className="view-section active">
        <div className="app-main-header" >
          <div>
            <h1 className="app-main-title">Workspace Hub</h1>
            <p className="app-main-subtitle">Jump back into your projects or initialize a new enterprise initiative.</p>
          </div>
          <button onClick={() => document.getElementById('create-project-modal').showModal()} className="btn btn-primary">+ New Workspace</button>
        </div>

        <h3 className="project-group-title">🔥 Projects You Lead</h3>
        <div id="leader-grid" className="project-grid"></div>

        <h3 className="project-group-title">🤝 Projects You've Joined</h3>
        <div id="member-grid" className="project-grid"></div>
      </section>

    </main>
  </div>

  
  <dialog id="create-project-modal">
    <div className="modal-shell">
    <h2 className="modal-title">Create Workspace</h2>
    <p className="modal-subtitle">Initialize a new project environment for your team to collaborate.</p>
    
    <form id="create-project-form" className="modal-form">
      <div className="modal-field">
        <label htmlFor="cp-name">WORKSPACE NAME</label>
        <input className="modal-input" type="text" id="cp-name" required={true} placeholder="e.g. Acme Integration" />
      </div>
      <div className="modal-field">
        <label htmlFor="cp-title">INTERNAL ALIAS (OPTIONAL)</label>
        <input className="modal-input" type="text" id="cp-title" placeholder="e.g. Project Phoenix" />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={() => document.getElementById('create-project-modal').close()}>Cancel</button>
        <button type="submit" className="btn btn-primary">Initialize</button>
      </div>
    </form>
    </div>
  </dialog>

  <dialog id="invites-modal">
    <div className="modal-shell">
    <div className="modal-header">
      <h3 className="modal-title">Pending Invites</h3>
      <button type="button" className="btn btn-ghost" onClick={() => document.getElementById('invites-modal').close()}>Close</button>
    </div>
    <div id="invites-content" className="modal-form">
      
    </div>
    </div>
  </dialog>

  


    </>
  );
}
