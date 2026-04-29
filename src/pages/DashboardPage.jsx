import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request, escapeHtml, formatFullDate, formatDate, normalizeTaskStatus, isArchivedTask, normalizeTask, initialsFor } from '../utils/api';
import ThemeToggle from '../components/ThemeToggle';

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser: authCurrentUser, logout } = useAuth();

  useEffect(() => {
    if (!authCurrentUser) return;
    let currentUser = authCurrentUser;
    const toastContainer = document.getElementById("toast-container");

    // Use a custom mechanism for URL parameters inside the JS
    const originalURLSearchParams = URLSearchParams;
    window.URLSearchParams = function(query) {
      return new originalURLSearchParams(location.search);
    };

    // We'll wrap all the logic from dashboard.js here
let teamData = null;
let tasksData = [];
let archivedTasksData = [];
let messagesData = [];
const TASK_ARCHIVE_DELAY_MS = 24 * 60 * 60 * 1000;
const MOVE_PERMISSION_MESSAGE = "You can only move tasks assigned to you";
const EDIT_PERMISSION_MESSAGE = "Only the project leader can edit task details";
const DELETE_PERMISSION_MESSAGE = "Only the project leader can delete tasks";
const CREATE_PERMISSION_MESSAGE = "Only the project leader can create tasks";
let taskModalMode = "create";
let editingTaskId = "";
const contributionTrackerState = {
  archived: "idle",
  tasks: "idle",
  team: "idle"
};
const CONTRIBUTION_PALETTE = [
  { end: "#0ea5e9", solid: "#14b8a6", start: "#2dd4bf" },
  { end: "#4f46e5", solid: "#3b82f6", start: "#1d4ed8" },
  { end: "#7c3aed", solid: "#a855f7", start: "#c084fc" },
  { end: "#f97316", solid: "#fb923c", start: "#f59e0b" },
  { end: "#ec4899", solid: "#f43f5e", start: "#fb7185" },
  { end: "#22c55e", solid: "#16a34a", start: "#84cc16" }
];
let confirmAction = null;
let confirmLabelDefault = "Confirm";

function showToast(message, type = "success") {
  if (!toastContainer) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 280);
  }, 2800);
}

function resetConfirmModalState() {
  confirmAction = null;
  confirmLabelDefault = "Confirm";
  const confirmConfirmBtn = document.getElementById("confirm-confirm-btn");
  if (confirmConfirmBtn) {
    confirmConfirmBtn.disabled = false;
    confirmConfirmBtn.textContent = confirmLabelDefault;
  }
}

function openConfirmModal({ title, message, confirmLabel = "Confirm", onConfirm }) {
  const confirmModal = document.getElementById("confirm-modal");
  const confirmModalTitle = document.getElementById("confirm-modal-title");
  const confirmModalMessage = document.getElementById("confirm-modal-message");
  const confirmConfirmBtn = document.getElementById("confirm-confirm-btn");

  if (!confirmModal || !confirmModalTitle || !confirmModalMessage || !confirmConfirmBtn) {
    return;
  }

  confirmAction = onConfirm;
  confirmLabelDefault = confirmLabel;
  confirmModalTitle.textContent = title;
  confirmModalMessage.textContent = message;
  confirmConfirmBtn.disabled = false;
  confirmConfirmBtn.textContent = confirmLabel;
  confirmModal.showModal();
}

async function request(url, options = {}) {
  // Automatically inject teamId from URL into API requests
  const urlParams = new URLSearchParams(window.location.search);
  const teamId = urlParams.get("teamId");

  let fetchUrl = url;
  if (teamId) {
    const encodedTeamId = encodeURIComponent(teamId);
    if (!fetchUrl.includes("teamId=")) {
      fetchUrl += (fetchUrl.includes("?") ? "&" : "?") + `teamId=${encodedTeamId}`;
    }

    if (options.method && options.method !== "GET" && options.method !== "HEAD") {
      let bodyObj = {};
      if (typeof options.body === "string" && options.body.trim()) {
        try {
          bodyObj = JSON.parse(options.body);
        } catch {
          bodyObj = {};
        }
      }
      bodyObj.teamId = teamId;
      options.body = JSON.stringify(bodyObj);
    }
  }

  const response = await fetch(fetchUrl, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  let payload = {};
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

// Format date helper
function formatDate(isoString) {
  if(!isoString) return "";
  const d = new Date(isoString);
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatFullDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function isLeadRole(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return normalizedRole === "leader" || normalizedRole === "project lead";
}

function normalizeTaskStatus(status) {
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (normalizedStatus === "done" || normalizedStatus === "completed") {
    return "Done";
  }

  if (normalizedStatus === "in progress" || normalizedStatus === "in-progress") {
    return "In Progress";
  }

  return "To Do";
}

function formatTaskPriority(priorityValue) {
  const normalizedPriority = String(priorityValue || "").trim().toLowerCase();

  if (!normalizedPriority) {
    return "Normal";
  }

  return normalizedPriority.charAt(0).toUpperCase() + normalizedPriority.slice(1);
}

function initialsForName(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "•";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeTask(task = {}) {
  if (!task || typeof task !== "object") {
    return null;
  }

  const title = String(task.title || "").trim();
  if (!title) {
    return null;
  }

  return {
    ...task,
    assignee: String(task.assignee || "").trim(),
    assigneeId: String(task.assigneeId || "").trim(),
    assignees: Array.isArray(task.assignees)
      ? task.assignees
        .map((assignee) => ({
          id: String(assignee?.id || "").trim(),
          name: String(assignee?.name || "").trim()
        }))
        .filter((assignee) => assignee.id || assignee.name)
      : [],
    archivedAt: String(task.archivedAt || "").trim(),
    completedAt: String(task.completedAt || task.doneAt || "").trim(),
    comments: Array.isArray(task.comments) ? task.comments : [],
    deadline: String(task.deadline || "").trim(),
    description: String(task.description || "").trim(),
    id: String(task.id || "").trim(),
    priority: formatTaskPriority(task.priority || task.urgency),
    status: normalizeTaskStatus(task.status),
    teamId: String(task.teamId || "").trim(),
    teamName: String(task.teamName || "").trim(),
    title
  };
}

function isArchivedTask(task) {
  return Boolean(String(task?.archivedAt || "").trim());
}

function getCurrentTeamMember() {
  const members = Array.isArray(teamData?.members) ? teamData.members : [];
  return members.find((member) => member.userId === currentUser?.id) || null;
}

function isCurrentUserLeader() {
  if (!currentUser || !teamData) {
    return false;
  }

  if (teamData.createdBy === currentUser.id) {
    return true;
  }

  return isLeadRole(getCurrentTeamMember()?.role);
}

function isTaskAssignedToCurrentUser(task) {
  if (!task || !currentUser) {
    return false;
  }

  if (Array.isArray(task.assignees) && task.assignees.some((assignee) => assignee?.id === currentUser.id)) {
    return true;
  }

  const assigneeId = String(task.assigneeId || "").trim();
  const assigneeName = String(task.assignee || "").trim();

  return (
    (assigneeId && assigneeId === String(currentUser.id || "").trim()) ||
    (assigneeName && assigneeName === String(currentUser.name || "").trim())
  );
}

function canMoveTask(task) {
  return isCurrentUserLeader() || isTaskAssignedToCurrentUser(task);
}

function canEditTask(task) {
  return Boolean(task) && isCurrentUserLeader();
}

function canDeleteTask(task) {
  return Boolean(task) && isCurrentUserLeader();
}

function findTaskById(taskId) {
  return [...tasksData, ...archivedTasksData].find((task) => task?.id === taskId) || null;
}

function getTaskAssigneeMemberIds(task) {
  if (!task) return [];
  const members = Array.isArray(teamData?.members) ? teamData.members : [];
  
  if (Array.isArray(task.assignees) && task.assignees.length > 0) {
    return task.assignees.map(a => a.id);
  }

  if (task.assigneeId) {
    const byId = members.find((member) => member.userId === task.assigneeId);
    if (byId) return [byId.userId];
  }

  const byName = members.find((member) => String(member.name || "").trim() === String(task.assignee || "").trim());
  return byName?.userId ? [byName.userId] : [];
}

function syncTaskAssigneeOptions(selectedMemberIds = [], isEditMode = false, taskStatus = "To Do") {
  const container = document.getElementById("task-assignees-container");
  const members = Array.isArray(teamData?.members) ? teamData.members : [];

  if (!container) return;

  const isDisabled = isEditMode && taskStatus === "In Progress";
  
  let html = `<div class="assignee-helper">
    ${isEditMode ? "" : '<span>Leave empty to let AI auto-assign the best fit.</span>'}
    ${isDisabled ? '<strong class="assignee-helper-note">Assignees lock while a task is in progress.</strong>' : ""}
  </div>`;
  
  html += `<div class="assignee-option-list">`;
  
  members.forEach((member) => {
    const isChecked = selectedMemberIds.includes(member.userId) ? "checked" : "";
    const disabledAttr = isDisabled ? "disabled" : "";
    const disabledClass = isDisabled ? " is-disabled" : "";
    html += `
      <label class="assignee-option${disabledClass}">
        <input type="checkbox" class="assignee-checkbox" value="${escapeHtml(member.userId)}" data-name="${escapeHtml(member.name)}" ${isChecked} ${disabledAttr} />
        <span>${escapeHtml(member.name)}</span>
      </label>
    `;
  });
  
  html += `</div>`;
  container.innerHTML = html;
}

function getSelectedAssigneePayload() {
  const checkboxes = document.querySelectorAll("#task-assignees-container .assignee-checkbox:checked");
  const assignees = Array.from(checkboxes).map(cb => ({
    id: cb.value,
    name: cb.dataset.name
  }));
  
  return { assignees };
}

function formatTaskAssignees(task) {
  if (Array.isArray(task?.assignees) && task.assignees.length > 0) {
    return task.assignees.map(a => escapeHtml(String(a.name || "").trim())).filter(Boolean).join(", ");
  }
  return escapeHtml(String(task?.assignee || "Unassigned").trim() || "Unassigned");
}

function getCompletionWindowLabel(task) {
  if (isArchivedTask(task)) {
    return task.archivedAt ? `Archived ${formatFullDate(task.archivedAt)}` : "Archived";
  }

  const completedTimestamp = Date.parse(task?.completedAt || "");
  if (!Number.isFinite(completedTimestamp)) {
    return "Movable for 24 hours after completion";
  }

  const remainingMs = Math.max(TASK_ARCHIVE_DELAY_MS - (Date.now() - completedTimestamp), 0);
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.max(1, Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000)));

  if (hours > 0) {
    return `Movable for ${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `Movable for ${minutes}m`;
}

function renderWorkspaceOverview() {
  const memberCount = Array.isArray(teamData?.members) ? teamData.members.length : 0;
  const activeTasks = Array.isArray(tasksData) ? tasksData.filter((task) => !isArchivedTask(task)).length : 0;
  const inProgressTasks = Array.isArray(tasksData) ? tasksData.filter((task) => task.status === "In Progress").length : 0;
  const completedTasks = Array.isArray(tasksData) ? tasksData.filter((task) => task.status === "Done").length : 0;
  const archivedCount = Array.isArray(archivedTasksData) ? archivedTasksData.length : 0;
  const messageCount = Array.isArray(messagesData) ? messagesData.length : 0;
  const workspaceName = teamData?.projectTitle || teamData?.name || "Workspace";

  const valueMap = {
    "workspace-overview-members": memberCount,
    "workspace-overview-active": activeTasks,
    "workspace-overview-progress": inProgressTasks,
    "workspace-overview-completed": completedTasks + archivedCount
  };

  Object.entries(valueMap).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(value);
    }
  });

  const overviewTitle = document.getElementById("workspace-overview-title");
  if (overviewTitle) {
    overviewTitle.textContent = `${workspaceName} is live`;
  }

  const overviewCopy = document.getElementById("workspace-overview-copy");
  if (overviewCopy) {
    overviewCopy.textContent = `${memberCount} teammate${memberCount === 1 ? "" : "s"}, ${activeTasks} active task${activeTasks === 1 ? "" : "s"}, and ${messageCount} message${messageCount === 1 ? "" : "s"} are currently in the loop.`;
  }

  const overviewRole = document.getElementById("workspace-overview-role");
  if (overviewRole) {
    overviewRole.textContent = isCurrentUserLeader() ? "Leader controls enabled" : "Assigned-task mode";
  }

  const overviewRhythm = document.getElementById("workspace-overview-rhythm");
  if (overviewRhythm) {
    overviewRhythm.textContent = archivedCount > 0
      ? `${archivedCount} archived task${archivedCount === 1 ? "" : "s"} ready for review`
      : "Chat refreshes every 5 seconds";
  }

  const boardSubtitle = document.getElementById("board-subtitle");
  if (boardSubtitle) {
    boardSubtitle.textContent = `${workspaceName} • ${memberCount} member${memberCount === 1 ? "" : "s"} • ${activeTasks} active task${activeTasks === 1 ? "" : "s"}`;
  }

  const chatSubtitle = document.getElementById("chat-subtitle");
  if (chatSubtitle) {
    chatSubtitle.textContent = `${messageCount} message${messageCount === 1 ? "" : "s"} in the workspace channel`;
  }

  const chatPanelCopy = document.getElementById("chat-panel-copy");
  if (chatPanelCopy) {
    chatPanelCopy.textContent = messageCount === 0
      ? "Start the conversation with a quick update, blocker, or handoff."
      : "Quick coordination, mentions, and project notes live here.";
  }
}

function updateContributionSourceState(source, status) {
  contributionTrackerState[source] = status;
  renderContributionTracker();
}

function isContributionTrackerLoading() {
  return ["team", "tasks", "archived"].some((source) => {
    const status = contributionTrackerState[source];
    return status === "idle" || status === "loading";
  });
}

function hasContributionTrackerError() {
  return ["team", "tasks", "archived"].some((source) => contributionTrackerState[source] === "error");
}

function isContributionTaskCompleted(task) {
  return (
    isArchivedTask(task) ||
    normalizeTaskStatus(task?.status) === "Done" ||
    Boolean(String(task?.completedAt || "").trim())
  );
}

function getContributionTasks() {
  const merged = [...(Array.isArray(tasksData) ? tasksData : []), ...(Array.isArray(archivedTasksData) ? archivedTasksData : [])];
  const seen = new Set();

  return merged
    .map(normalizeTask)
    .filter(Boolean)
    .filter((task) => {
      if (!task.id || seen.has(task.id)) {
        return false;
      }

      seen.add(task.id);
      return true;
    });
}

function buildContributionModel() {
  const members = Array.isArray(teamData?.members) ? teamData.members : [];
  const tasks = getContributionTasks();
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(isContributionTaskCompleted).length;

  const memberRows = members
    .map((member, index) => {
      const assignedTasks = tasks.filter((task) => {
        if (Array.isArray(task.assignees) && task.assignees.some((assignee) => assignee?.id === member.userId)) {
          return true;
        }

        const assigneeId = String(task.assigneeId || "").trim();
        const assigneeName = String(task.assignee || "").trim();
        return (
          (assigneeId && assigneeId === member.userId) ||
          (assigneeName && assigneeName === String(member.name || "").trim())
        );
      });

      const completedCount = assignedTasks.filter(isContributionTaskCompleted).length;
      const percentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

      return {
        color: CONTRIBUTION_PALETTE[index % CONTRIBUTION_PALETTE.length],
        completedCount,
        initials: initialsForName(member.name),
        name: String(member.name || "Unnamed member").trim(),
        percentage,
        role: String(member.role || "Member").trim() || "Member",
        totalTasks
      };
    })
    .sort((left, right) => right.completedCount - left.completedCount || left.name.localeCompare(right.name));

  return {
    completedTasks,
    hasMembers: memberRows.length > 0,
    members: memberRows,
    totalTasks
  };
}

function buildContributionChartMarkup(model) {
  const chartMembers = model.members.filter((member) => member.percentage > 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let progressOffset = 0;

  const segments = chartMembers.map((member, index) => {
    const dash = Math.max((member.percentage / 100) * circumference, 0);
    const gap = Math.max(circumference - dash, 0);
    const segment = `
      <circle
        class="svg-ring contribution-ring-segment"
        cx="60"
        cy="60"
        r="${radius}"
        stroke="${member.color.solid}"
        style="stroke-dasharray:${dash} ${gap}; stroke-dashoffset:${-progressOffset}; animation-delay:${index * 120}ms;"
      ></circle>
    `;

    progressOffset += dash;
    return segment;
  }).join("");

  return `
    <div class="contribution-donut-frame ${chartMembers.length > 0 ? "is-active" : "is-placeholder"}">
      <svg class="svg-pie contribution-donut" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="contribution-donut-track" cx="60" cy="60" r="${radius}"></circle>
        ${segments || `<circle class="contribution-donut-placeholder" cx="60" cy="60" r="${radius}"></circle>`}
      </svg>
      <div class="contribution-donut-center">
        <span class="contribution-donut-label">Total Tasks</span>
        <strong class="contribution-donut-value">${escapeHtml(model.totalTasks)}</strong>
      </div>
    </div>
  `;
}

function buildContributionLegendMarkup(model) {
  const activeMembers = model.members.filter((member) => member.percentage > 0);

  if (activeMembers.length === 0) {
    return `
      <div class="contribution-legend-empty">
        <span class="contribution-legend-dot is-muted"></span>
        Complete a task to light up the chart
      </div>
    `;
  }

  return activeMembers.map((member) => `
    <div class="contribution-legend-item">
      <span class="contribution-legend-dot" style="--legend-color:${member.color.solid};"></span>
      <span>${escapeHtml(member.name)} - ${escapeHtml(member.percentage)}%</span>
    </div>
  `).join("");
}

function buildContributionCardsMarkup(model) {
  return model.members.map((member, index) => `
    <article
      class="contribution-member-card"
      style="--member-end:${member.color.end}; --member-progress:${member.percentage}%; --member-solid:${member.color.solid}; --member-start:${member.color.start}; animation-delay:${index * 70}ms;"
    >
      <div class="contribution-member-card-head">
        <div class="contribution-member-identity">
          <div class="contribution-member-avatar">${escapeHtml(member.initials)}</div>
          <div class="contribution-member-copy">
            <h3 class="contribution-member-name">${escapeHtml(member.name)}</h3>
            <p class="contribution-member-role">${escapeHtml(member.role)}</p>
          </div>
        </div>
        <strong class="contribution-member-share">${escapeHtml(member.percentage)}%</strong>
      </div>
      <div class="contribution-member-progress">
        <span class="contribution-member-progress-fill"></span>
      </div>
      <div class="contribution-member-stats">
        <span>${escapeHtml(member.completedCount)} / ${escapeHtml(member.totalTasks)} tasks completed</span>
        <span>${escapeHtml(Math.max(member.totalTasks - member.completedCount, 0))} remaining</span>
      </div>
    </article>
  `).join("");
}

function buildContributionLoadingMarkup() {
  return `
    <div class="contribution-chart-skeleton">
      <div class="contribution-skeleton-circle"></div>
      <div class="contribution-skeleton-lines">
        <span class="contribution-skeleton-line is-wide"></span>
        <span class="contribution-skeleton-line"></span>
      </div>
    </div>
  `;
}

function buildContributionLoadingLegendMarkup() {
  return Array.from({ length: 3 }, () => `
    <span class="contribution-legend-skeleton"></span>
  `).join("");
}

function buildContributionLoadingCardsMarkup() {
  return Array.from({ length: 4 }, (_, index) => `
    <div class="contribution-loading-card" style="animation-delay:${index * 80}ms;">
      <div class="contribution-loading-head">
        <span class="contribution-skeleton-avatar"></span>
        <div class="contribution-loading-copy">
          <span class="contribution-skeleton-line is-medium"></span>
          <span class="contribution-skeleton-line is-short"></span>
        </div>
        <span class="contribution-skeleton-line is-tiny"></span>
      </div>
      <span class="contribution-skeleton-bar"></span>
      <div class="contribution-loading-foot">
        <span class="contribution-skeleton-line is-short"></span>
        <span class="contribution-skeleton-line is-short"></span>
      </div>
    </div>
  `).join("");
}

function buildContributionEmptyMarkup() {
  return `
    <div class="contribution-empty-state">
      <div class="contribution-empty-icon" aria-hidden="true"></div>
      <h3 class="contribution-empty-title">No contribution data yet</h3>
      <p class="contribution-empty-copy">Start completing tasks to see insights</p>
    </div>
  `;
}

function renderContributionTracker() {
  const pie = document.getElementById("analytics-pie-chart");
  const legend = document.getElementById("analytics-pie-legend");
  const bars = document.getElementById("analytics-bars");
  if (!pie || !legend || !bars) {
    return;
  }

  if (isContributionTrackerLoading()) {
    pie.innerHTML = buildContributionLoadingMarkup();
    legend.innerHTML = buildContributionLoadingLegendMarkup();
    bars.innerHTML = buildContributionLoadingCardsMarkup();
    return;
  }

  if (hasContributionTrackerError()) {
    const emptyModel = { members: [], totalTasks: 0 };
    pie.innerHTML = buildContributionChartMarkup(emptyModel);
    legend.innerHTML = buildContributionLegendMarkup(emptyModel);
    bars.innerHTML = buildContributionEmptyMarkup();
    return;
  }

  const model = buildContributionModel();

  pie.innerHTML = buildContributionChartMarkup(model);
  legend.innerHTML = buildContributionLegendMarkup(model);

  if (!model.hasMembers || model.totalTasks === 0) {
    bars.innerHTML = buildContributionEmptyMarkup();
    return;
  }

  bars.innerHTML = buildContributionCardsMarkup(model);
}

function loadAnalyticsV2() {
  renderContributionTracker();
}

async function bootstrap() {
  try {
    renderContributionTracker();
    
    // Add user chip content
    const chip = document.getElementById("nav-user-chip");
    if(chip) {
      chip.textContent = `Hey, ${currentUser.name.split(' ')[0]}!`;
    }
    
    await loadTeam();
    await Promise.all([loadTasks(), loadArchivedTasks(), loadMessages()]);
  } catch (err) {
    console.error("Not logged in!", err);
    navigate("/index.html");
  }
}



async function loadTeam() {
  updateContributionSourceState("team", "loading");
  try {
    const payload = await request("/api/team", { method: "GET" });
    teamData = payload.team || null;
    const teamList = document.getElementById("team-list");
    
    // Inject sidebar context data
    const ctxName = document.getElementById("context-team-name");
    const ctxMeta = document.getElementById("context-team-meta");
    if(ctxName) ctxName.textContent = teamData?.projectTitle || teamData?.name || "Workspace";
    if(ctxMeta) ctxMeta.textContent = teamData?.name ? `${teamData.name} • ${teamData.members?.length || 0} members` : "Connected";
    renderWorkspaceOverview();

    if(!teamList) return;
    
    if(!teamData || !teamData.members || teamData.members.length === 0) {
      teamList.innerHTML = `
        <div class="team-empty">You aren't in a workspace yet.</div>
        <button class="btn btn-secondary wide-button" onclick="document.getElementById('create-team-modal').showModal()">Create Workspace</button>
      `;
      const invitePanel = document.getElementById("invite-panel");
      if (invitePanel) {
        invitePanel.style.display = "none";
      }
      const addTaskButton = document.getElementById("add-task-btn");
      if (addTaskButton) {
        addTaskButton.disabled = true;
        addTaskButton.title = "Join or create a team to manage tasks";
      }
      syncTaskAssigneeOptions([], false);
      updateContributionSourceState("team", "success");
      return;
    }
    
    teamList.innerHTML = teamData.members.map(m => `
      <div class="team-member-row">
        <div class="team-member-main">
          <div class="team-member-avatar">${escapeHtml(initialsForName(m.name))}</div>
          <div class="team-member-copy">
            <strong class="team-member-name">${escapeHtml(m.name)}</strong>
            <span class="team-member-role team-member-role-badge">${escapeHtml(m.role || "Member")}</span>
          </div>
        </div>
      </div>
    `).join('');
    
    const invitePanel = document.getElementById("invite-panel");
    if(invitePanel) {
      invitePanel.style.display = isCurrentUserLeader() ? "block" : "none";
    }

    syncTaskAssigneeOptions([], false);

    const addTaskButton = document.getElementById("add-task-btn");
    if (addTaskButton) {
      const canCreateTask = isCurrentUserLeader();
      addTaskButton.disabled = !canCreateTask;
      addTaskButton.title = canCreateTask ? "" : CREATE_PERMISSION_MESSAGE;
    }

    renderTasks();
    renderArchivedTasks();
    updateContributionSourceState("team", "success");
  } catch(e) {
    console.error("Failed to load team");
    updateContributionSourceState("team", "error");
  }
}


async function loadTasks() {
  updateContributionSourceState("tasks", "loading");
  try {
    const payload = await request("/api/tasks", { method: "GET" });
    tasksData = Array.isArray(payload.tasks)
      ? payload.tasks.map(normalizeTask).filter(Boolean)
      : [];
    renderTasks();
    renderWorkspaceOverview();
    updateContributionSourceState("tasks", "success");
  } catch(e) {
    console.error("Failed to load tasks");
    updateContributionSourceState("tasks", "error");
  }
}

async function loadArchivedTasks() {
  updateContributionSourceState("archived", "loading");
  try {
    const payload = await request("/api/tasks/archive", { method: "GET" });
    archivedTasksData = Array.isArray(payload.tasks)
      ? payload.tasks.map(normalizeTask).filter(Boolean)
      : [];
    renderArchivedTasks();
    renderWorkspaceOverview();
    updateContributionSourceState("archived", "success");
  } catch (e) {
    console.error("Failed to load archived tasks");
    updateContributionSourceState("archived", "error");
  }
}

function renderTasks() {
  const cols = {
    "To Do": document.getElementById("col-todo"),
    "In Progress": document.getElementById("col-progress"),
    "Done": document.getElementById("col-done")
  };
  
  if(!cols["To Do"]) return;
  
  Object.values(cols).forEach(c => c.innerHTML = ""); // clear
  
  const safeTasks = Array.isArray(tasksData)
    ? tasksData.map(normalizeTask).filter(Boolean)
    : [];
  const activeTasks = safeTasks.filter((task) => !isArchivedTask(task));
  tasksData = activeTasks;

  if(activeTasks.length === 0) {
    cols["To Do"].innerHTML = `
      <div class="task-empty task-empty-state">
        <div class="task-empty-icon" aria-hidden="true"></div>
        <strong class="task-empty-title">No tasks yet</strong>
        <p class="task-empty-copy">Add the first task to turn this board into motion.</p>
      </div>
    `;
    return;
  }
  
  activeTasks.forEach(task => {
    const targetStatus = task.status || "To Do";
    const col = cols[targetStatus] || cols["To Do"];
    const isDoneTask = targetStatus === "Done";
    const canMove = canMoveTask(task);
    const canEdit = canEditTask(task);
    const canDelete = canDeleteTask(task);
    const actionButtons = [];

    if (isDoneTask) {
      if (canMove) {
        actionButtons.push(
          `<button class="btn btn-ghost" data-task-action="move" data-task-id="${task.id}" data-task-status="To Do">To Do</button>`,
          `<button class="btn btn-ghost" data-task-action="move" data-task-id="${task.id}" data-task-status="In Progress">In Progress</button>`
        );
      }
    } else if (canMove) {
      actionButtons.push(
        `<button class="btn btn-ghost" data-task-action="move" data-task-id="${task.id}" data-task-status="${targetStatus === 'Done' ? 'In Progress' : 'To Do'}">←</button>`,
        `<button class="btn btn-ghost" data-task-action="move" data-task-id="${task.id}" data-task-status="${targetStatus === 'To Do' ? 'In Progress' : 'Done'}">→</button>`
      );
    }

    if (canEdit) {
      actionButtons.push(`<button class="btn btn-ghost" data-task-action="edit" data-task-id="${task.id}">Edit</button>`);
    }

    if (canDelete) {
      actionButtons.push(`<button class="btn btn-ghost task-delete-btn" data-task-action="delete" data-task-id="${task.id}">Trash</button>`);
    }

    const actionMarkup = isDoneTask
      ? `
        <div class="task-locked-row">
          <span class="task-state-pill is-completed">Completed</span>
          <span class="task-state-pill ${canMove ? "is-editable" : "is-locked"}">${canMove ? "Movable" : "View Only"}</span>
        </div>
        <div class="task-lock-note">${canMove ? getCompletionWindowLabel(task) : MOVE_PERMISSION_MESSAGE}</div>
        ${actionButtons.length > 0
          ? `<div class="task-actions" style="--task-action-count:${actionButtons.length}">${actionButtons.join("")}</div>`
          : ""}
      `
      : `
        ${!canMove ? `<div class="task-lock-note">${MOVE_PERMISSION_MESSAGE}</div>` : ""}
        ${actionButtons.length > 0
          ? `<div class="task-actions" style="--task-action-count:${actionButtons.length}">${actionButtons.join("")}</div>`
          : ""}
      `;
    
    const div = document.createElement("div");
    div.className = `task-card ${isDoneTask ? "task-card-completed-window" : ""}`;
    div.draggable = canMove;
    
    div.innerHTML = `
      <div class="task-state-row">
        <span class="task-state-pill ${targetStatus === "Done" ? "is-completed" : "is-active"}">${targetStatus === "Done" ? "Completed" : "Active"}</span>
        ${!canMove ? `<span class="task-state-pill is-locked">View Only</span>` : ""}
      </div>
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-desc">${escapeHtml(task.description || "No description provided.")}</div>
      <div class="task-meta">
        <strong class="task-assignee" title="${formatTaskAssignees(task)}">${formatTaskAssignees(task)}</strong>
        <span class="task-urgency">${escapeHtml(task.priority || "Normal")}</span>
      </div>
      ${actionMarkup}
    `;
    col.appendChild(div);
  });
}

function renderArchivedTasks() {
  const archiveList = document.getElementById("archive-list");
  const archiveSubtitle = document.getElementById("archive-subtitle");
  if (!archiveList) return;

  const safeArchivedTasks = Array.isArray(archivedTasksData)
    ? archivedTasksData.map(normalizeTask).filter(Boolean).filter(isArchivedTask)
    : [];
  archivedTasksData = safeArchivedTasks;

  if (archiveSubtitle) {
    archiveSubtitle.textContent = safeArchivedTasks.length === 0
      ? "No archived tasks yet."
      : `${safeArchivedTasks.length} archived task${safeArchivedTasks.length === 1 ? "" : "s"} ready to review.`;
  }

  if (safeArchivedTasks.length === 0) {
    archiveList.innerHTML = `
      <div class="archive-empty">
        <div class="task-empty-icon archive-empty-icon" aria-hidden="true"></div>
        <strong class="task-empty-title">Archive is empty</strong>
        <p class="task-empty-copy">Completed work will appear here 24 hours after it lands in Done.</p>
      </div>
    `;
    return;
  }

  archiveList.innerHTML = safeArchivedTasks.map((task) => `
    <article class="archive-card">
      <div class="archive-card-copy">
        <div class="task-state-row">
          <span class="task-state-pill is-archived">Archived</span>
          <span class="task-state-pill is-locked">Locked</span>
        </div>
        <h3 class="archive-card-title">${escapeHtml(task.title)}</h3>
        <p class="archive-card-desc">${escapeHtml(task.description || "No description provided.")}</p>
        <div class="archive-meta-grid">
          <div class="archive-meta-item">
            <span class="archive-meta-label">Assignee</span>
            <strong title="${formatTaskAssignees(task)}">${formatTaskAssignees(task)}</strong>
          </div>
          <div class="archive-meta-item">
            <span class="archive-meta-label">Completed</span>
            <strong>${formatFullDate(task.completedAt) || "Recently"}</strong>
          </div>
          <div class="archive-meta-item">
            <span class="archive-meta-label">Archived</span>
            <strong>${formatFullDate(task.archivedAt) || "Now"}</strong>
          </div>
        </div>
      </div>
      ${canDeleteTask(task)
        ? `<div class="archive-card-actions"><button class="btn btn-danger" data-archive-action="delete" data-task-id="${task.id}">Delete</button></div>`
        : ""}
    </article>
  `).join("");
}

window.updateTaskStatus = async (taskId, newStatus) => {
  const task = findTaskById(taskId);
  if (!canMoveTask(task)) {
    showToast(MOVE_PERMISSION_MESSAGE, "error");
    return;
  }

  try {
    await request("/api/tasks/" + taskId, { method: "PUT", body: JSON.stringify({ status: newStatus }) });
    loadTasks();
    loadArchivedTasks();
  } catch(e) { showToast("Failed to move task. " + e.message, "error"); }
};

window.deleteTask = async (taskId) => {
  const task = findTaskById(taskId);
  if (!canDeleteTask(task)) {
    showToast(DELETE_PERMISSION_MESSAGE, "error");
    return;
  }

  openConfirmModal({
    title: "Delete this task?",
    message: "This will remove the task from the board for everyone in the workspace.",
    confirmLabel: "Delete Task",
    onConfirm: async () => {
      try {
        await request("/api/tasks/" + taskId, { method: "DELETE" });
        tasksData = tasksData.filter((task) => task.id !== taskId);
        renderTasks();
        loadTasks();
        loadArchivedTasks();
      } catch(e) { showToast("Failed to delete task. " + e.message, "error"); }
    }
  });
};

window.deleteArchivedTask = async (taskId) => {
  const task = findTaskById(taskId);
  if (!canDeleteTask(task)) {
    showToast(DELETE_PERMISSION_MESSAGE, "error");
    return;
  }

  openConfirmModal({
    title: "Delete this archived task?",
    message: "This permanently removes the task from the archive and cannot be undone.",
    confirmLabel: "Delete Forever",
    onConfirm: async () => {
      try {
        await request("/api/tasks/" + taskId, { method: "DELETE" });
        archivedTasksData = archivedTasksData.filter((task) => task.id !== taskId);
        renderArchivedTasks();
        loadArchivedTasks();
      } catch(e) { showToast("Failed to delete archived task. " + e.message, "error"); }
    }
  });
};

const kanbanBoard = document.querySelector(".kanban-board");
if (kanbanBoard) {
  kanbanBoard.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-task-action]");
    if (!actionButton) {
      return;
    }

    const taskId = String(actionButton.dataset.taskId || "").trim();
    const action = actionButton.dataset.taskAction;

    if (!taskId) {
      return;
    }

    if (action === "delete") {
      window.deleteTask(taskId);
      return;
    }

    if (action === "edit") {
      const task = findTaskById(taskId);
      if (task) {
        openTaskModal("edit", task);
      }
      return;
    }

    if (action === "move") {
      const nextStatus = String(actionButton.dataset.taskStatus || "").trim();
      if (nextStatus) {
        window.updateTaskStatus(taskId, nextStatus);
      }
    }
  });
}

const archiveList = document.getElementById("archive-list");
if (archiveList) {
  archiveList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-archive-action]");
    if (!actionButton) {
      return;
    }

    const taskId = String(actionButton.dataset.taskId || "").trim();
    if (!taskId) {
      return;
    }

    if (actionButton.dataset.archiveAction === "delete") {
      window.deleteArchivedTask(taskId);
    }
  });
}

// Team & Invite Form Logic
document.getElementById("create-team-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("new-team-name").value.trim();
  if(!name) return;
  try {
    await request("/api/team", { method: "POST", body: JSON.stringify({ name }) });
    window.location.reload();
  } catch(err) { showToast("Failed to create workspace. " + err.message, "error"); }
});

const inviteForm = document.getElementById("invite-form");
if(inviteForm) {
  inviteForm.addEventListener("submit", async(e) => {
    e.preventDefault();
    const email = document.getElementById("invite-email").value.trim();
    try {
      await request("/api/team/members", { method: "POST", body: JSON.stringify({ email }) });
      document.getElementById("invite-email").value = "";
      showToast("Invite sent.", "success");
    } catch(err) { showToast("Failed to invite. " + err.message, "error"); }
  });
}

// --- Global Sidebar Navigation ---
window.switchDashboardView = function(viewId, btnElement) {
  document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
  if(btnElement) btnElement.classList.add('active');
  
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('view-' + viewId);
  if(target) target.classList.add('active');
  
  if(viewId === 'contributions') loadAnalyticsV2();
  if(viewId === 'archive') loadArchivedTasks();
};

// Add Task Modal Logic
const addTaskBtn = document.getElementById("add-task-btn");
const taskModal = document.getElementById("task-modal");
const closeTaskBtn = document.getElementById("close-task-modal");
const taskForm = document.getElementById("task-form");
const taskModalTitle = document.getElementById("task-modal-title");
const taskSubmitBtn = document.getElementById("task-submit-btn");
const confirmModal = document.getElementById("confirm-modal");
const confirmCancelBtn = document.getElementById("confirm-cancel-btn");
const confirmConfirmBtn = document.getElementById("confirm-confirm-btn");

function resetTaskModalState() {
  taskModalMode = "create";
  editingTaskId = "";

  if (taskModalTitle) {
    taskModalTitle.textContent = "New Task";
  }

  if (taskSubmitBtn) {
    taskSubmitBtn.textContent = "Create Task";
  }

  if (taskForm) {
    taskForm.reset();
  }

  syncTaskAssigneeOptions([], false);
}

function openTaskModal(mode = "create", task = null) {
  if (!taskModal || !taskForm) {
    return;
  }

  if (mode === "edit") {
    if (!task || !canEditTask(task)) {
      showToast(EDIT_PERMISSION_MESSAGE, "error");
      return;
    }

    taskModalMode = "edit";
    editingTaskId = task.id;

    if (taskModalTitle) {
      taskModalTitle.textContent = "Edit Task";
    }

    if (taskSubmitBtn) {
      taskSubmitBtn.textContent = "Save Changes";
    }

    document.getElementById("task-title").value = task.title || "";
    document.getElementById("task-desc").value = task.description || "";
    syncTaskAssigneeOptions(getTaskAssigneeMemberIds(task), true, task.status);
  } else {
    resetTaskModalState();
  }

  if (!taskModal.open) {
    taskModal.showModal();
  }
}

if(addTaskBtn && taskModal && closeTaskBtn && taskForm) {
  addTaskBtn.addEventListener("click", () => {
    if (!isCurrentUserLeader()) {
      showToast(CREATE_PERMISSION_MESSAGE, "error");
      return;
    }

    openTaskModal("create");
  });
  closeTaskBtn.addEventListener("click", () => taskModal.close());
  taskModal.addEventListener("close", resetTaskModalState);
  
  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById("task-title");
    const descriptionInput = document.getElementById("task-desc");
    const title = String(titleInput?.value || "").trim();
    const description = String(descriptionInput?.value || "").trim();
    const isEditMode = taskModalMode === "edit";
    const editingTask = isEditMode ? findTaskById(editingTaskId) : null;

    if (isEditMode) {
      if (!canEditTask(editingTask)) {
        showToast(EDIT_PERMISSION_MESSAGE, "error");
        return;
      }
    } else if (!isCurrentUserLeader()) {
      showToast(CREATE_PERMISSION_MESSAGE, "error");
      return;
    }

    if(!title) {
      if(titleInput) titleInput.focus();
      showToast("Task title is required.", "error");
      return;
    }

    if(taskSubmitBtn) {
      taskSubmitBtn.disabled = true;
      taskSubmitBtn.textContent = isEditMode ? "Saving..." : "Creating...";
    }

    try {
      const assigneePayload = getSelectedAssigneePayload();

      if (isEditMode && editingTaskId) {
        const payload = await request("/api/tasks/" + editingTaskId, {
          method: "PUT",
          body: JSON.stringify({ title, description, ...assigneePayload })
        });
        const updatedTask = normalizeTask(payload.task);

        if(updatedTask) {
          tasksData = tasksData.map((task) => task.id === updatedTask.id ? updatedTask : task);
          renderTasks();
        }
      } else {
        const payload = await request("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ title, description, ...assigneePayload })
        });
        const createdTask = normalizeTask(payload.task);

        if(createdTask) {
          tasksData = [...tasksData, createdTask];
          renderTasks();
        }
      }

      if (taskModal.open) {
        taskModal.close();
      }
      loadTasks();
      loadArchivedTasks();
      showToast(isEditMode ? "Task updated." : "Task created.", "success");
    } catch(err) {
      showToast(`Failed to ${isEditMode ? "save" : "create"} task. ` + err.message, "error");
    } finally {
      if(taskSubmitBtn) {
        taskSubmitBtn.disabled = false;
        taskSubmitBtn.textContent = taskModalMode === "edit" ? "Save Changes" : "Create Task";
      }
    }
  });
}

if (confirmModal && confirmCancelBtn && confirmConfirmBtn) {
  confirmCancelBtn.onclick = () => confirmModal.close();
  confirmConfirmBtn.onclick = async () => {
    if (!confirmAction) {
      confirmModal.close();
      return;
    }

    const actionToRun = confirmAction;
    confirmConfirmBtn.disabled = true;

    try {
      await actionToRun();
    } finally {
      confirmModal.close();
    }
  };
  confirmModal.onclose = resetConfirmModalState;
}

// Chat logic
async function loadMessages() {
  try {
    const payload = await request("/api/messages", { method: "GET" });
    messagesData = payload.messages || [];
    renderMessages();
  } catch(e) {
    console.error("Failed to load messages", e);
  }
}

function renderMessages() {
  const container = document.getElementById("chat-container");
  if(!container) return;
  
  if(messagesData.length === 0) {
    container.innerHTML = `<div class="chat-empty">It's quiet here.</div>`;
    renderWorkspaceOverview();
    return;
  }
  
  container.innerHTML = messagesData.map(msg => `
    <div class="chat-message ${msg.userId === currentUser.id ? 'is-me' : ''}">
      <div class="chat-message-head">
        <strong>${escapeHtml(msg.userName || msg.name || 'Unknown')}</strong>
        <span class="chat-message-time">${formatDate(msg.createdAt || msg.timestamp)}</span>
      </div>
      <div>${escapeHtml(msg.text || msg.content || '')}</div>
    </div>
  `).join('');
  
  container.scrollTop = container.scrollHeight;
  renderWorkspaceOverview();
}

const chatForm = document.getElementById("chat-form");
if(chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    const val = input.value.trim();
    if(!val) return;
    
    input.value = "";
    
    // Optimistic update
    messagesData.push({
      id: Date.now().toString(),
      userName: currentUser.name,
      userId: currentUser.id,
      text: val,
      createdAt: new Date().toISOString()
    });
    renderMessages();
    
    // Send to backend
    try {
      await request("/api/messages", {
        method: "POST",
        body: JSON.stringify({ text: val })
      });
      loadMessages();
    } catch(err) {
      console.error("Failed to send message", err);
    }
  });
}

const logoutBtn = document.getElementById("nav-logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try { await request("/api/auth/logout", { body: JSON.stringify({}), method: "POST" }); }
    finally { window.location.assign("/"); }
  });
}

// Reload messages every 5 seconds to keep chat fresh!
window._chatPollInterval = setInterval(loadMessages, 5000);

bootstrap();


    // Add event listeners for navigation and modals
    const handleNavigation = (e) => {
      const el = e.currentTarget;
      if (el.dataset.navigate) {
        navigate(el.dataset.navigate.replace('.html', ''));
      } else if (el.dataset.action === 'switchDashboardView') {
        switchDashboardView(el.dataset.viewArgs);
      }
    };

    // Handle global clicks
    const handleGlobalClick = (e) => {
      const target = e.target.closest('[data-navigate], [data-action]');
      if (!target) return;
      if (target.dataset.navigate) {
        navigate(target.dataset.navigate.replace('.html', ''));
      } else if (target.dataset.action === 'switchDashboardView') {
        switchDashboardView(target.dataset.viewArgs);
      }
    };
    
    document.addEventListener('click', handleGlobalClick);

    // Call bootstrap
    bootstrap();

    return () => {
      document.removeEventListener('click', handleGlobalClick);
      window.URLSearchParams = originalURLSearchParams; // restore
      if (window._chatPollInterval) {
        clearInterval(window._chatPollInterval);
        window._chatPollInterval = null;
      }
    };
  }, [authCurrentUser, navigate, location.search]);

  return (
    <div className="dashboard-body">
      <div className="toast-container" id="toast-container"></div>
      

  <div className="app-layout">
    
    
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand" data-navigate="/">
          <div className="brand-mark">C</div>
          CollabSpace
        </div>
        <div className="project-context-card" id="project-context-card">
          <h3 className="project-context-title" id="context-team-name">Workspace</h3>
          <p className="project-context-subtitle" id="context-team-meta">Connecting...</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button className="sidebar-nav-item active" data-action="switchDashboardView" data-view-args="board">
          <span>Dashboard</span>
        </button>
        <button className="sidebar-nav-item" data-action="switchDashboardView" data-view-args="archive">
          <span>Archive</span>
        </button>
        <button className="sidebar-nav-item" data-action="switchDashboardView" data-view-args="contributions">
          <span>Contributions</span>
        </button>
        <button className="sidebar-nav-item" data-action="switchDashboardView" data-view-args="chat">
          <span>Chat</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle className="sidebar-nav-item" />
        <span id="nav-user-chip" className="project-context-subtitle" ></span>
        <button data-navigate="/home.html" className="sidebar-nav-item">Back to Hub</button>
        <button id="nav-logout" className="sidebar-nav-item">Log Out</button>
      </div>
    </aside>

    
    <main className="app-main">
      
      
      <section id="view-board" className="view-section active">
        <div className="app-main-header">
          <h1 className="app-main-title">Team Dashboard</h1>
          <p className="app-main-subtitle" id="board-subtitle">Project Overview</p>
        </div>

        <div className="dashboard-command-grid">
          <article className="dashboard-command-card dashboard-command-feature">
            <span className="dashboard-command-kicker">Workspace Pulse</span>
            <h2 id="workspace-overview-title" className="dashboard-command-title">Syncing workspace...</h2>
            <p id="workspace-overview-copy" className="dashboard-command-copy">Pulling the latest task, member, and chat activity.</p>
            <div className="dashboard-status-row">
              <span id="workspace-overview-role" className="status-pill">Loading role...</span>
              <span id="workspace-overview-rhythm" className="status-pill subtle">Checking archive state...</span>
            </div>
          </article>

          <article className="dashboard-command-card">
            <span className="dashboard-command-label">Members</span>
            <strong id="workspace-overview-members" className="dashboard-command-value">0</strong>
            <span className="dashboard-command-note">Connected to this workspace</span>
          </article>

          <article className="dashboard-command-card">
            <span className="dashboard-command-label">Active Tasks</span>
            <strong id="workspace-overview-active" className="dashboard-command-value">0</strong>
            <span className="dashboard-command-note">Total work currently on the board</span>
          </article>

          <article className="dashboard-command-card">
            <span className="dashboard-command-label">In Progress</span>
            <strong id="workspace-overview-progress" className="dashboard-command-value">0</strong>
            <span className="dashboard-command-note">Tasks being actively pushed forward</span>
          </article>

          <article className="dashboard-command-card">
            <span className="dashboard-command-label">Completed + Archived</span>
            <strong id="workspace-overview-completed" className="dashboard-command-value">0</strong>
            <span className="dashboard-command-note">Visible delivery history for the team</span>
          </article>
        </div>
        
        <div className="board-header">
          <h2 className="board-title">Task Board</h2>
          <button className="btn btn-primary" id="add-task-btn">+ Add Task</button>
        </div>
        
        <div className="kanban-board">
          <div className="kanban-column"><h3 className="kanban-column-title title-todo">To Do</h3><div id="col-todo" className="task-list"></div></div>
          <div className="kanban-column"><h3 className="kanban-column-title title-progress">In Progress</h3><div id="col-progress" className="task-list"></div></div>
          <div className="kanban-column"><h3 className="kanban-column-title title-done">Done</h3><div id="col-done" className="task-list"></div></div>
        </div>

        <div className="dashboard-lower-grid">
          <div className="dashboard-panel team-panel">
            <h3 className="sidebar-title">Group Members</h3>
            <div id="team-list" className="team-list"></div>
            <div id="invite-panel" className="team-invite-panel" >
              <h4 className="sidebar-title">Add Member</h4>
              <form id="invite-form" className="inline-form">
                <input className="settings-input" type="email" id="invite-email" placeholder="student@edu" required={true} />
                <button type="submit" className="btn btn-secondary">Invite</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section id="view-archive" className="view-section">
        <div className="app-main-header">
          <h1 className="app-main-title">Completed Tasks Archive</h1>
          <p className="app-main-subtitle">Tasks move here automatically 24 hours after completion. Archived tasks stay view-only, and only the project leader can delete them.</p>
        </div>

        <div className="dashboard-panel archive-panel">
          <div className="archive-panel-header">
            <div>
              <h2 className="board-title">Archive</h2>
              <p className="archive-panel-subtitle" id="archive-subtitle">Loading archived tasks...</p>
            </div>
          </div>
          <div id="archive-list" className="archive-list"></div>
        </div>
      </section>

      
      <section id="view-contributions" className="view-section">
        <div className="app-main-header">
          <h1 className="app-main-title">Contribution Tracker</h1>
          <p className="app-main-subtitle">See how each member is contributing to the project</p>
        </div>
        
        <div id="analytics-content-v2" className="contribution-layout">
          <section className="dashboard-panel contribution-panel contribution-breakdown-panel">
            <div className="contribution-panel-head">
              <h2 className="board-title">Contribution Breakdown</h2>
              <p className="contribution-panel-copy">Live progress across the team, based on completed work.</p>
            </div>
            <div id="analytics-pie-chart" className="contribution-chart-shell"></div>
            <div id="analytics-pie-legend" className="contribution-legend"></div>
          </section>
          <div id="analytics-bars" className="contribution-member-list"></div>
        </div>
      </section>

      
      <section id="view-chat" className="view-section">
        <div className="app-main-header">
          <h1 className="app-main-title">Team Chat</h1>
          <p className="app-main-subtitle" id="chat-subtitle">Members</p>
        </div>
        
        <div className="dashboard-panel" >
          <div className="chat-panel-header">
            <div>
              <h2 className="board-title">Workspace Channel</h2>
              <p id="chat-panel-copy" className="chat-panel-copy">Live project conversation and quick mentions.</p>
            </div>
            <span className="status-pill subtle">5s refresh</span>
          </div>
          <div id="chat-container" className="chat-box" ></div>
          <form id="chat-form" >
            <div >
              <span >📝</span>
              <input type="text" id="chat-input" className="settings-input" placeholder="Type a message... (use @name to mention)" required={true}  />
            </div>
            <button type="submit" className="btn btn-primary" >Send</button>
          </form>
        </div>
      </section>

    </main>
  </div>

  
  <dialog id="task-modal">
    <div className="modal-shell">
    <h3 id="task-modal-title" className="modal-title">New Task</h3>
    <form id="task-form" className="modal-form">
      <div className="modal-field">
        <label>What needs doing?</label>
        <input className="modal-input" type="text" id="task-title" required={true} />
      </div>
      <div className="modal-field">
        <label>Details</label>
        <textarea className="modal-textarea" id="task-desc" rows="3"></textarea>
      </div>
      <div className="modal-field">
        <label>Assign To</label>
        <div id="task-assignees-container" className="checkbox-list"></div>
      </div>
      <div className="modal-actions">
        <button type="button" id="close-task-modal" className="btn btn-ghost">Cancel</button>
        <button type="submit" id="task-submit-btn" className="btn btn-primary">Create Task</button>
      </div>
    </form>
    </div>
  </dialog>
  
  <dialog id="analytics-modal">
    <div className="modal-shell">
    <div className="modal-header">
      <h3 className="modal-title">Workspace Analytics</h3>
      <button type="button" className="btn btn-ghost" onClick={() => document.getElementById('analytics-modal').close()}>Close</button>
    </div>
    <div id="analytics-content">
      
      <div className="team-empty">Loading...</div>
    </div>
    </div>
  </dialog>

  
  <dialog id="create-team-modal">
    <div className="modal-shell">
    <h3 className="modal-title">Create a workspace</h3>
    <form id="create-team-form" className="modal-form">
      <div className="modal-field">
        <label>Workspace Name</label>
        <input className="modal-input" type="text" id="new-team-name" required={true} />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={() => document.getElementById('create-team-modal').close()}>Cancel</button>
        <button type="submit" className="btn btn-primary">Create Workspace</button>
      </div>
    </form>
    </div>
  </dialog>

  <dialog id="confirm-modal">
    <div className="modal-shell">
      <div className="modal-header">
        <h3 id="confirm-modal-title" className="modal-title">Confirm action</h3>
      </div>
      <p id="confirm-modal-message" className="confirm-copy">Please confirm before continuing.</p>
      <div className="modal-actions confirm-actions">
        <button type="button" id="confirm-cancel-btn" className="btn btn-ghost">Cancel</button>
        <button type="button" id="confirm-confirm-btn" className="btn btn-danger">Confirm</button>
      </div>
    </div>
  </dialog>

  

  

    </div>
  );
}
