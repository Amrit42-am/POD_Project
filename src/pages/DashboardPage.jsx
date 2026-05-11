import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request, escapeHtml, formatFullDate, formatDate, normalizeTaskStatus, isArchivedTask, normalizeTask, initialsFor } from '../utils/api';
import ThemeToggle from '../components/ThemeToggle';
import logoImg from '../images/Logo.png';

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser: authCurrentUser, logout } = useAuth();

  useEffect(() => {
    if (!authCurrentUser) return;
    let currentUser = authCurrentUser;
    const toastContainer = document.getElementById("toast-container");

    // We'll wrap all the logic from dashboard.js here
let teamData = null;
let tasksData = [];
let archivedTasksData = [];
let messagesData = [];
let peerRatingsData = {
  currentUserRatings: {},
  members: [],
  summary: {
    eligibleRaters: 0,
    participationCount: 0,
    teamAverageScore: 0,
    totalRatings: 0
  }
};
let weeklyReportData = null;
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

function getTaskAssigneeNames(task) {
  if (Array.isArray(task?.assignees) && task.assignees.length > 0) {
    const names = task.assignees
      .map((assignee) => String(assignee?.name || "").trim())
      .filter(Boolean);
    if (names.length > 0) {
      return names;
    }
  }

  const assigneeName = String(task?.assignee || "").trim();
  return assigneeName ? [assigneeName] : [];
}

function formatDeadlineInputValue(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return text;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDeadlineValue(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatReminderDistance(deadlineValue) {
  const dueDate = parseDeadlineValue(deadlineValue);
  if (!dueDate) {
    return "No due date";
  }

  const diffMs = dueDate.getTime() - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    if (Math.abs(diffHours) < 24) {
      return `Overdue by ${Math.max(1, Math.abs(diffHours))}h`;
    }
    return `Overdue by ${Math.max(1, Math.abs(diffDays))}d`;
  }

  if (diffHours <= 24) {
    return diffHours <= 1 ? "Due within 1h" : `Due in ${diffHours}h`;
  }

  if (diffDays <= 7) {
    return `Due in ${diffDays}d`;
  }

  return `Due ${dueDate.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

function buildDeadlineReminderModel() {
  const reminders = [];
  const safeTasks = Array.isArray(tasksData) ? tasksData : [];
  const activeTasks = safeTasks.filter(
    (task) => !isArchivedTask(task) && normalizeTaskStatus(task?.status) !== "Done"
  );
  const now = Date.now();
  const nextWeekMs = 7 * 24 * 60 * 60 * 1000;
  const nextDayMs = 24 * 60 * 60 * 1000;

  activeTasks.forEach((task) => {
    const dueDate = parseDeadlineValue(task?.deadline);
    if (!dueDate) {
      return;
    }

    const diffMs = dueDate.getTime() - now;
    if (diffMs > nextWeekMs) {
      return;
    }

    const isMine = isTaskAssignedToCurrentUser(task);
    const severity = diffMs < 0 ? "overdue" : diffMs <= nextDayMs ? "urgent" : "upcoming";
    const severityRank = diffMs < 0 ? 0 : diffMs <= nextDayMs ? 1 : 2;
    reminders.push({
      assignees: getTaskAssigneeNames(task),
      dueLabel: formatReminderDistance(task.deadline),
      dueTime: dueDate.getTime(),
      id: `task-${task.id}`,
      isMine,
      severity,
      severityRank,
      subtitle: task.priority ? `${task.priority} priority` : "Open task",
      title: String(task.title || "Untitled task").trim()
    });
  });

  const projectDeadline = parseDeadlineValue(teamData?.deadline);
  if (projectDeadline && projectDeadline.getTime() - now <= 14 * 24 * 60 * 60 * 1000) {
    const diffMs = projectDeadline.getTime() - now;
    reminders.push({
      assignees: [],
      dueLabel: formatReminderDistance(teamData.deadline),
      dueTime: projectDeadline.getTime(),
      id: "project-deadline",
      isMine: true,
      severity: diffMs < 0 ? "overdue" : diffMs <= nextWeekMs ? "urgent" : "upcoming",
      severityRank: diffMs < 0 ? 0 : diffMs <= nextWeekMs ? 1 : 2,
      subtitle: "Workspace milestone",
      title: `${teamData?.projectTitle || teamData?.name || "Workspace"} deadline`
    });
  }

  reminders.sort((left, right) => {
    return (
      left.severityRank - right.severityRank ||
      Number(right.isMine) - Number(left.isMine) ||
      left.dueTime - right.dueTime ||
      left.title.localeCompare(right.title)
    );
  });

  const overdueCount = reminders.filter((item) => item.severity === "overdue").length;
  const urgentCount = reminders.filter((item) => item.severity === "urgent").length;
  const upcomingCount = reminders.filter((item) => item.severity === "upcoming").length;

  return {
    items: reminders,
    overdueCount,
    upcomingCount,
    urgentCount
  };
}

function buildReminderItemMarkup(item) {
  const assigneeLabel = item.assignees.length > 0 ? item.assignees.join(", ") : "Team-wide";
  return `
    <article class="deadline-reminder-card is-${item.severity}">
      <div class="deadline-reminder-copy">
        <div class="deadline-reminder-head">
          <strong>${escapeHtml(item.title)}</strong>
          ${item.isMine ? '<span class="task-state-pill is-editable">Mine</span>' : ""}
        </div>
        <p class="deadline-reminder-meta">${escapeHtml(item.subtitle)} · ${escapeHtml(assigneeLabel)}</p>
      </div>
      <span class="deadline-reminder-badge is-${item.severity}">${escapeHtml(item.dueLabel)}</span>
    </article>
  `;
}

function renderDeadlineReminderPanel() {
  const stats = document.getElementById("deadline-reminder-stats");
  const list = document.getElementById("deadline-reminder-list");
  const subtitle = document.getElementById("deadline-reminder-subtitle");
  const model = buildDeadlineReminderModel();

  if (!stats || !list || !subtitle) {
    return;
  }

  subtitle.textContent = teamData
    ? "Live alerts for overdue work, near-term deadlines, and the project milestone."
    : "Join a workspace to start tracking deadline reminders.";

  if (!teamData) {
    stats.innerHTML = `
      <div class="deadline-stat-card">
        <span class="dashboard-command-label">Reminders</span>
        <strong class="dashboard-command-value">0</strong>
        <span class="dashboard-command-note">No workspace connected</span>
      </div>
    `;
    list.innerHTML = `
      <div class="team-empty">
        Connect to a workspace to see due dates and upcoming checkpoints here.
      </div>
    `;
    return;
  }

  stats.innerHTML = `
    <div class="deadline-stat-card is-overdue">
      <span class="dashboard-command-label">Overdue</span>
      <strong class="dashboard-command-value">${model.overdueCount}</strong>
      <span class="dashboard-command-note">Items already past due</span>
    </div>
    <div class="deadline-stat-card is-urgent">
      <span class="dashboard-command-label">Next 24h</span>
      <strong class="dashboard-command-value">${model.urgentCount}</strong>
      <span class="dashboard-command-note">Needs attention today</span>
    </div>
    <div class="deadline-stat-card">
      <span class="dashboard-command-label">This Week</span>
      <strong class="dashboard-command-value">${model.upcomingCount}</strong>
      <span class="dashboard-command-note">Upcoming checkpoints</span>
    </div>
  `;

  if (model.items.length === 0) {
    list.innerHTML = `
      <div class="deadline-reminder-empty">
        <strong class="task-empty-title">No urgent deadlines right now</strong>
        <p class="task-empty-copy">Add due dates while creating tasks and this reminder center will stay on watch for the team.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = model.items.slice(0, 4).map(buildReminderItemMarkup).join("");
}

function renderReminderCenter() {
  const content = document.getElementById("deadline-modal-content");
  if (!content) {
    return;
  }

  const model = buildDeadlineReminderModel();
  if (!teamData) {
    content.innerHTML = `<div class="team-empty">No workspace selected yet.</div>`;
    return;
  }

  // Read current filter/sort from data attributes or default
  const currentFilter = content.dataset.activeFilter || "all";
  const currentSort = content.dataset.activeSort || "severity";

  // Filter items
  let filtered = model.items;
  if (currentFilter === "overdue") filtered = model.items.filter(i => i.severity === "overdue");
  else if (currentFilter === "urgent") filtered = model.items.filter(i => i.severity === "urgent");
  else if (currentFilter === "upcoming") filtered = model.items.filter(i => i.severity === "upcoming");
  else if (currentFilter === "mine") filtered = model.items.filter(i => i.isMine);

  // Snooze: filter out snoozed items
  const snoozedIds = JSON.parse(sessionStorage.getItem("collabspace_snoozed") || "[]");
  filtered = filtered.filter(i => !snoozedIds.includes(i.id));

  // Sort items
  if (currentSort === "duedate") {
    filtered.sort((a, b) => a.dueTime - b.dueTime);
  }
  // default "severity" sort is already applied by buildDeadlineReminderModel

  const filterButtons = [
    { key: "all", label: "All", count: model.items.filter(i => !snoozedIds.includes(i.id)).length },
    { key: "overdue", label: "Overdue", count: model.overdueCount },
    { key: "urgent", label: "Next 24h", count: model.urgentCount },
    { key: "upcoming", label: "This Week", count: model.upcomingCount },
    { key: "mine", label: "Mine Only", count: model.items.filter(i => i.isMine && !snoozedIds.includes(i.id)).length }
  ];

  const statsMarkup = `
    <div class="rc-stats-row">
      <div class="rc-stat is-overdue">
        <strong>${model.overdueCount}</strong>
        <span>Overdue</span>
      </div>
      <div class="rc-stat is-urgent">
        <strong>${model.urgentCount}</strong>
        <span>Due Today</span>
      </div>
      <div class="rc-stat">
        <strong>${model.upcomingCount}</strong>
        <span>This Week</span>
      </div>
      <div class="rc-stat rc-stat-total">
        <strong>${model.items.length}</strong>
        <span>Total</span>
      </div>
    </div>
  `;

  const filterMarkup = `
    <div class="rc-toolbar">
      <div class="rc-filter-bar">
        ${filterButtons.map(f => `
          <button class="rc-filter-btn ${currentFilter === f.key ? "is-active" : ""}" data-rc-filter="${f.key}">
            ${escapeHtml(f.label)}
            <span class="rc-filter-count">${f.count}</span>
          </button>
        `).join("")}
      </div>
      <div class="rc-sort-bar">
        <button class="rc-sort-btn ${currentSort === "severity" ? "is-active" : ""}" data-rc-sort="severity">By Severity</button>
        <button class="rc-sort-btn ${currentSort === "duedate" ? "is-active" : ""}" data-rc-sort="duedate">By Due Date</button>
      </div>
    </div>
  `;

  let listMarkup;
  if (filtered.length === 0) {
    const emptyMsg = currentFilter === "all"
      ? "No active deadlines in this workspace. Add due dates to tasks to activate reminders."
      : `No ${currentFilter === "mine" ? "deadlines assigned to you" : currentFilter + " items"} right now.`;
    listMarkup = `
      <div class="rc-empty">
        <div class="rc-empty-icon">✓</div>
        <strong>All clear</strong>
        <p>${escapeHtml(emptyMsg)}</p>
      </div>
    `;
  } else {
    listMarkup = `
      <div class="rc-list">
        ${filtered.map(item => {
          const assigneeLabel = item.assignees.length > 0 ? item.assignees.join(", ") : "Team-wide";
          return `
            <article class="rc-card is-${item.severity}">
              <div class="rc-card-indicator is-${item.severity}"></div>
              <div class="rc-card-body">
                <div class="rc-card-head">
                  <strong>${escapeHtml(item.title)}</strong>
                  <div class="rc-card-pills">
                    ${item.isMine ? '<span class="rc-pill rc-pill-mine">Assigned to you</span>' : ''}
                    <span class="rc-pill rc-pill-severity is-${item.severity}">${item.severity === "overdue" ? "Overdue" : item.severity === "urgent" ? "Urgent" : "Upcoming"}</span>
                  </div>
                </div>
                <p class="rc-card-meta">${escapeHtml(item.subtitle)} · ${escapeHtml(assigneeLabel)}</p>
              </div>
              <div class="rc-card-right">
                <span class="deadline-reminder-badge is-${item.severity}">${escapeHtml(item.dueLabel)}</span>
                <button class="rc-snooze-btn" data-rc-snooze="${escapeHtml(item.id)}" title="Dismiss this reminder for this session">Dismiss</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  const snoozedCount = snoozedIds.length;
  const snoozedNote = snoozedCount > 0
    ? `<div class="rc-snoozed-note"><span>${snoozedCount} dismissed</span><button class="rc-restore-btn" data-rc-restore>Restore all</button></div>`
    : "";

  content.innerHTML = statsMarkup + filterMarkup + listMarkup + snoozedNote;

  // Wire filter clicks
  content.querySelectorAll("[data-rc-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      content.dataset.activeFilter = btn.dataset.rcFilter;
      renderReminderCenter();
    });
  });

  // Wire sort clicks
  content.querySelectorAll("[data-rc-sort]").forEach(btn => {
    btn.addEventListener("click", () => {
      content.dataset.activeSort = btn.dataset.rcSort;
      renderReminderCenter();
    });
  });

  // Wire snooze clicks
  content.querySelectorAll("[data-rc-snooze]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.rcSnooze;
      const current = JSON.parse(sessionStorage.getItem("collabspace_snoozed") || "[]");
      if (!current.includes(id)) current.push(id);
      sessionStorage.setItem("collabspace_snoozed", JSON.stringify(current));
      renderReminderCenter();
      showToast("Reminder dismissed for this session.", "success");
    });
  });

  // Wire restore
  const restoreBtn = content.querySelector("[data-rc-restore]");
  if (restoreBtn) {
    restoreBtn.addEventListener("click", () => {
      sessionStorage.removeItem("collabspace_snoozed");
      renderReminderCenter();
      showToast("All dismissed reminders restored.", "success");
    });
  }
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

  // Update focus strip chips
  const focusTasks = document.getElementById('focus-tasks-due');
  const focusTeam = document.getElementById('focus-team-online');
  if (focusTasks) focusTasks.textContent = `${inProgressTasks} task${inProgressTasks !== 1 ? 's' : ''} in progress`;
  if (focusTeam) focusTeam.textContent = `${memberCount} team member${memberCount !== 1 ? 's' : ''}`;


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
  renderPeerRatingPanel();
  renderWeeklyReportPreview();
  loadPeerRatings();
  loadWeeklyReport();
}

function formatRatingValue(value) {
  const rating = Number(value || 0);
  return rating > 0 ? `${rating.toFixed(1)}/5` : "No ratings yet";
}

function renderPeerRatingPanel() {
  const summary = document.getElementById("peer-rating-summary");
  const list = document.getElementById("peer-rating-list");
  const actionButton = document.getElementById("open-peer-rating-btn");

  if (!summary || !list || !actionButton) {
    return;
  }

  const members = Array.isArray(teamData?.members) ? teamData.members : [];

  if (!teamData) {
    actionButton.disabled = true;
    summary.innerHTML = `<div class="team-empty">Join a workspace to unlock peer ratings.</div>`;
    list.innerHTML = "";
    return;
  }

  if (members.length <= 1) {
    actionButton.disabled = true;
    summary.innerHTML = `
      <div class="peer-rating-hero">
        <strong class="task-empty-title">Peer ratings start with a team</strong>
        <p class="task-empty-copy">Invite at least one teammate to collect collaboration scores and balance feedback.</p>
      </div>
    `;
    list.innerHTML = "";
    return;
  }

  actionButton.disabled = false;

  const safeSummary = peerRatingsData.summary || {
    participationCount: 0,
    teamAverageScore: 0,
    totalRatings: 0
  };
  const safeMembers = Array.isArray(peerRatingsData.members) ? peerRatingsData.members : [];

  summary.innerHTML = `
    <div class="peer-rating-summary-grid">
      <div class="peer-rating-stat">
        <span class="dashboard-command-label">Team Average</span>
        <strong class="dashboard-command-value">${escapeHtml(formatRatingValue(safeSummary.teamAverageScore))}</strong>
        <span class="dashboard-command-note">Current average score across saved peer reviews.</span>
      </div>
      <div class="peer-rating-stat">
        <span class="dashboard-command-label">Participation</span>
        <strong class="dashboard-command-value">${escapeHtml(`${safeSummary.participationCount}/${members.length}`)}</strong>
        <span class="dashboard-command-note">Members who have submitted at least one teammate rating.</span>
      </div>
      <div class="peer-rating-stat">
        <span class="dashboard-command-label">Saved Reviews</span>
        <strong class="dashboard-command-value">${escapeHtml(String(safeSummary.totalRatings || 0))}</strong>
        <span class="dashboard-command-note">Numeric peer reviews currently stored for this workspace.</span>
      </div>
    </div>
  `;

  list.innerHTML = safeMembers.map((member) => {
    const myRating = peerRatingsData.currentUserRatings?.[member.userId]?.score || "";
    return `
      <article class="peer-rating-row">
        <div class="peer-rating-row-copy">
          <strong>${escapeHtml(member.name)}</strong>
          <span>${escapeHtml(member.role || "Member")}</span>
        </div>
        <div class="peer-rating-row-metrics">
          <span class="peer-rating-score">${escapeHtml(formatRatingValue(member.averageScore))}</span>
          <span class="peer-rating-note">${escapeHtml(`${member.reviewCount} review${member.reviewCount === 1 ? "" : "s"}`)}</span>
          ${myRating ? `<span class="status-pill subtle">You rated ${escapeHtml(String(myRating))}/5</span>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function renderPeerRatingForm() {
  const list = document.getElementById("peer-rating-form-list");
  if (!list) {
    return;
  }

  const members = Array.isArray(teamData?.members) ? teamData.members : [];
  const peers = members.filter((member) => member.userId !== currentUser?.id);

  if (peers.length === 0) {
    list.innerHTML = `<div class="team-empty">There are no teammates to rate yet.</div>`;
    return;
  }

  list.innerHTML = peers.map((member) => {
    const savedRating = peerRatingsData.currentUserRatings?.[member.userId] || {};
    return `
      <article class="peer-rating-form-card" data-rated-user-id="${escapeHtml(member.userId)}">
        <div class="peer-rating-form-head">
          <div>
            <strong>${escapeHtml(member.name)}</strong>
            <p class="contribution-panel-copy">${escapeHtml(member.role || "Member")}</p>
          </div>
          <span class="status-pill subtle">Update anytime</span>
        </div>
        <div class="modal-field">
          <label>Score</label>
          <select class="modal-select peer-rating-score-input">
            <option value="">Not rated yet</option>
            <option value="5" ${savedRating.score === 5 ? "selected" : ""}>5 - Outstanding</option>
            <option value="4" ${savedRating.score === 4 ? "selected" : ""}>4 - Strong</option>
            <option value="3" ${savedRating.score === 3 ? "selected" : ""}>3 - Solid</option>
            <option value="2" ${savedRating.score === 2 ? "selected" : ""}>2 - Needs support</option>
            <option value="1" ${savedRating.score === 1 ? "selected" : ""}>1 - Blocked</option>
          </select>
        </div>
        <div class="modal-field">
          <label>Quick note (optional)</label>
          <textarea class="modal-textarea peer-rating-feedback-input" rows="2" maxlength="240" placeholder="What stood out about their contribution?">${escapeHtml(savedRating.feedback || "")}</textarea>
        </div>
      </article>
    `;
  }).join("");
}

function renderWeeklyReportPreview() {
  const preview = document.getElementById("weekly-report-preview");
  const period = document.getElementById("weekly-report-period-label");
  if (!preview || !period) {
    return;
  }

  if (!teamData) {
    period.textContent = "No active workspace";
    preview.innerHTML = `<div class="team-empty">Connect to a workspace to generate a weekly progress report.</div>`;
    return;
  }

  if (!weeklyReportData) {
    period.textContent = "Generating latest summary...";
    preview.innerHTML = `
      <div class="weekly-report-loading">
        <span class="contribution-legend-skeleton"></span>
        <span class="contribution-legend-skeleton"></span>
      </div>
    `;
    return;
  }

  period.textContent = weeklyReportData.periodLabel;
  const summary = weeklyReportData.summary || {};
  const highlights = Array.isArray(weeklyReportData.highlights) ? weeklyReportData.highlights.slice(0, 2) : [];
  const generatedIso = String(weeklyReportData.generatedAt || "").trim();
  const generatedLabel = generatedIso ? formatFullDate(generatedIso) : "";
  const rawTeamName = String(weeklyReportData.teamName || "").trim();
  const teamNameSafe = escapeHtml(rawTeamName || "Workspace");

  preview.innerHTML = `
    <div class="weekly-report-preview-shell">
      <div class="weekly-report-hero">
        <strong>${escapeHtml(summary.headline || "No weekly activity yet.")}</strong>
        <p class="task-lock-note weekly-report-hero-note">Generated from live tasks, chat activity, and peer review data for this workspace.</p>
      </div>
      <div class="weekly-report-metric-grid">
        <article class="weekly-report-metric-card">
          <span class="dashboard-command-label">Created</span>
          <strong class="dashboard-command-value">${escapeHtml(String(summary.createdThisWeek || 0))}</strong>
        </article>
        <article class="weekly-report-metric-card">
          <span class="dashboard-command-label">Completed</span>
          <strong class="dashboard-command-value">${escapeHtml(String(summary.completedThisWeek || 0))}</strong>
        </article>
        <article class="weekly-report-metric-card">
          <span class="dashboard-command-label">Overdue</span>
          <strong class="dashboard-command-value">${escapeHtml(String(summary.overdueCount || 0))}</strong>
        </article>
        <article class="weekly-report-metric-card weekly-report-metric-card-peer">
          <span class="dashboard-command-label">Peer Avg</span>
          <strong class="dashboard-command-value weekly-report-peer-avg">${escapeHtml(formatRatingValue(summary.peerRatingAverage))}</strong>
        </article>
      </div>
      <div class="weekly-report-highlight-list">
        ${highlights.length === 0
        ? '<div class="deadline-reminder-empty"><strong class="task-empty-title">No recent wins yet</strong><p class="task-empty-copy">As tasks close out this week, they will appear here for a quick recap.</p></div>'
        : highlights.map((item) => `
          <article class="weekly-report-highlight-card">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.completedAt || "Completed recently")}</span>
          </article>
        `).join("")}
      </div>
      <footer class="weekly-report-preview-footer">
        <span class="weekly-report-preview-team" title="${teamNameSafe}">${teamNameSafe}</span>
        ${generatedLabel
    ? `<time class="weekly-report-preview-generated" datetime="${escapeHtml(generatedIso)}">${escapeHtml(generatedLabel)}</time>`
    : `<span class="weekly-report-preview-generated">—</span>`}
      </footer>
    </div>
  `;
}

function renderWeeklyReportModal() {
  const content = document.getElementById("weekly-report-content");
  if (!content) {
    return;
  }

  if (!teamData) {
    content.innerHTML = `<div class="team-empty">No workspace selected yet.</div>`;
    return;
  }

  if (!weeklyReportData) {
    content.innerHTML = `<div class="team-empty">Generating the latest report...</div>`;
    return;
  }

  const summary = weeklyReportData.summary || {};
  const memberBreakdown = Array.isArray(weeklyReportData.memberBreakdown)
    ? weeklyReportData.memberBreakdown
    : [];
  const highlights = Array.isArray(weeklyReportData.highlights)
    ? weeklyReportData.highlights
    : [];
  const attention = Array.isArray(weeklyReportData.attention)
    ? weeklyReportData.attention
    : [];

  content.innerHTML = `
    <div class="weekly-report-section">
      <div class="weekly-report-summary-grid">
        <article class="weekly-report-summary-card">
          <span class="dashboard-command-label">Created</span>
          <strong class="dashboard-command-value">${escapeHtml(String(summary.createdThisWeek || 0))}</strong>
          <span class="dashboard-command-note">New tasks added in the last 7 days.</span>
        </article>
        <article class="weekly-report-summary-card">
          <span class="dashboard-command-label">Completed</span>
          <strong class="dashboard-command-value">${escapeHtml(String(summary.completedThisWeek || 0))}</strong>
          <span class="dashboard-command-note">Tasks closed during this reporting window.</span>
        </article>
        <article class="weekly-report-summary-card">
          <span class="dashboard-command-label">Messages</span>
          <strong class="dashboard-command-value">${escapeHtml(String(summary.chatMessagesThisWeek || 0))}</strong>
          <span class="dashboard-command-note">Workspace chat updates captured this week.</span>
        </article>
        <article class="weekly-report-summary-card">
          <span class="dashboard-command-label">Peer Rating</span>
          <strong class="dashboard-command-value">${escapeHtml(formatRatingValue(summary.peerRatingAverage))}</strong>
          <span class="dashboard-command-note">Average saved peer rating across the current team.</span>
        </article>
      </div>
    </div>
    <div class="weekly-report-section">
      <h4 class="sidebar-title">Wins</h4>
      <div class="weekly-report-list">
        ${highlights.length === 0
          ? '<div class="team-empty">No completed tasks were logged in this window.</div>'
          : highlights.map((item) => `
            <article class="weekly-report-list-card">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.assignees?.join(", ") || "Team")} · ${escapeHtml(item.completedAt || "Completed recently")}</span>
            </article>
          `).join("")}
      </div>
    </div>
    <div class="weekly-report-section">
      <h4 class="sidebar-title">Needs Attention</h4>
      <div class="weekly-report-list">
        ${attention.length === 0
          ? '<div class="team-empty">No urgent blockers are flagged right now.</div>'
          : attention.map((item) => `
            <article class="weekly-report-list-card">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.dueLabel)} · ${escapeHtml(item.assignees?.join(", ") || "Team")}</span>
            </article>
          `).join("")}
      </div>
    </div>
    <div class="weekly-report-section">
      <h4 class="sidebar-title">Member Breakdown</h4>
      <div class="weekly-report-member-grid">
        ${memberBreakdown.length === 0
          ? '<div class="team-empty">No teammate activity is available yet.</div>'
          : memberBreakdown.map((member) => `
            <article class="weekly-report-member-card">
              <div class="weekly-report-member-head">
                <div>
                  <strong>${escapeHtml(member.name)}</strong>
                  <span>${escapeHtml(member.role || "Member")}</span>
                </div>
                <span class="status-pill subtle">${escapeHtml(formatRatingValue(member.averagePeerRating))}</span>
              </div>
              <div class="weekly-report-member-stats">
                <span>${escapeHtml(String(member.completedThisWeek || 0))} completed</span>
                <span>${escapeHtml(String(member.activeAssignments || 0))} active</span>
                <span>${escapeHtml(String(member.createdThisWeek || 0))} created</span>
              </div>
            </article>
          `).join("")}
      </div>
    </div>
  `;
}

async function loadPeerRatings() {
  try {
    if (!teamData?.id) {
      peerRatingsData = {
        currentUserRatings: {},
        members: [],
        summary: {
          eligibleRaters: 0,
          participationCount: 0,
          teamAverageScore: 0,
          totalRatings: 0
        }
      };
      renderPeerRatingPanel();
      return;
    }

    const payload = await request("/api/peer-ratings", { method: "GET" });
    peerRatingsData = payload.peerRatings || peerRatingsData;
    renderPeerRatingPanel();
  } catch (error) {
    console.error("Failed to load peer ratings", error);
    renderPeerRatingPanel();
  }
}

async function loadWeeklyReport() {
  try {
    if (!teamData?.id) {
      weeklyReportData = null;
      renderWeeklyReportPreview();
      renderWeeklyReportModal();
      return;
    }

    const payload = await request("/api/weekly-report", { method: "GET" });
    weeklyReportData = payload.report || null;
    renderWeeklyReportPreview();
    renderWeeklyReportModal();
  } catch (error) {
    console.error("Failed to load weekly report", error);
    renderWeeklyReportPreview();
    renderWeeklyReportModal();
  }
}

async function bootstrap() {
  try {
    renderContributionTracker();
    renderDeadlineReminderPanel();
    renderPeerRatingPanel();
    renderWeeklyReportPreview();
    
    // Add user chip content
    const chip = document.getElementById("nav-user-chip");
    if(chip) {
      chip.textContent = `Hey, ${currentUser.name.split(' ')[0]}!`;
    }
    
    await loadTeam();
    await Promise.all([loadTasks(), loadArchivedTasks(), loadMessages(), loadPeerRatings(), loadWeeklyReport()]);
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
    renderDeadlineReminderPanel();
    renderPeerRatingPanel();
    renderWeeklyReportPreview();

    if(!teamList) return;
    
    if(!teamData || !teamData.members || teamData.members.length === 0) {
      teamList.innerHTML = `
        <div class="team-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4;margin-bottom:0.75rem">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <strong style="display:block;font-size:0.95rem;font-weight:700;margin-bottom:0.35rem">No workspace yet</strong>
          <span style="font-size:0.82rem;opacity:0.65">Create one to start collaborating with your team.</span>
        </div>
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
      renderReminderCenter();
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
    renderDeadlineReminderPanel();
    renderReminderCenter();
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
    renderDeadlineReminderPanel();
    renderReminderCenter();
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
    renderDeadlineReminderPanel();
    renderReminderCenter();
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
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4;margin-bottom:0.75rem">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <strong class="task-empty-title">Board is clear</strong>
        <p class="task-empty-copy">Your team has no active tasks. Ready to start? Add the first one.</p>
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

    // Due date badge logic
    let deadlineBadge = "";
    if (task.deadline) {
      const now = Date.now();
      const due = parseDeadlineValue(task.deadline);
      if (due) {
        const diffHours = (due.getTime() - now) / (1000 * 60 * 60);
        const label = due.toLocaleDateString([], { month: "short", day: "numeric" });
        let cls = "deadline-ok";
        let icon = "Due";
        if (diffHours < 0) { cls = "deadline-overdue"; icon = "Overdue"; }
        else if (diffHours < 24) { cls = "deadline-soon"; icon = "Soon"; }
        deadlineBadge = `<div class="task-deadline ${cls}">${escapeHtml(icon)} ${escapeHtml(label)}</div>`;
      }
    }

    div.innerHTML = `
      <div class="task-state-row">
        <span class="task-state-pill ${targetStatus === "Done" ? "is-completed" : "is-active"}">${targetStatus === "Done" ? "Completed" : "Active"}</span>
        ${!canMove ? `<span class="task-state-pill is-locked">View Only</span>` : ""}
      </div>
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-desc">${escapeHtml(task.description || "No description provided.")}</div>
      ${deadlineBadge}
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
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4;margin-bottom:0.75rem">
          <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
        </svg>
        <strong class="task-empty-title">Archive is empty</strong>
        <p class="task-empty-copy">Completed tasks appear here automatically 24 hours after reaching Done.</p>
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
    loadWeeklyReport();
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
        loadWeeklyReport();
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
        loadWeeklyReport();
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
const deadlineModal = document.getElementById("deadline-modal");
const openReminderCenterBtn = document.getElementById("open-reminders-btn");
const closeReminderCenterBtn = document.getElementById("close-deadline-modal");
const peerRatingModal = document.getElementById("peer-rating-modal");
const openPeerRatingBtn = document.getElementById("open-peer-rating-btn");
const closePeerRatingBtn = document.getElementById("close-peer-rating-modal");
const peerRatingForm = document.getElementById("peer-rating-form");
const peerRatingSubmitBtn = document.getElementById("peer-rating-submit-btn");
const weeklyReportModal = document.getElementById("weekly-report-modal");
const openWeeklyReportBtn = document.getElementById("open-weekly-report-btn");
const refreshWeeklyReportBtn = document.getElementById("refresh-weekly-report-btn");
const closeWeeklyReportBtn = document.getElementById("close-weekly-report-modal");
const copyWeeklyReportBtn = document.getElementById("copy-weekly-report-btn");

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

  const titleInput = document.getElementById("task-title");
  const err = document.getElementById("task-title-error");
  if (titleInput) {
    titleInput.classList.remove('is-error', 'is-valid');
  }
  if (err) {
    err.classList.remove('visible');
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
    document.getElementById("task-deadline").value = formatDeadlineInputValue(task.deadline);
    const priorityValue = String(task.priority || "Medium").trim();
    document.getElementById("task-priority").value = ["Low", "Medium", "High"].includes(priorityValue)
      ? priorityValue
      : "Medium";
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
  
  // Real-time validation
  const titleInput = document.getElementById("task-title");
  if (titleInput) {
    titleInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      const err = document.getElementById("task-title-error");
      if (val) {
        e.target.classList.remove('is-error');
        e.target.classList.add('is-valid');
        err?.classList.remove('visible');
      } else {
        e.target.classList.remove('is-valid');
        e.target.classList.add('is-error');
        err?.classList.add('visible');
      }
    });
  }

  taskModal.addEventListener("close", resetTaskModalState);
  
  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById("task-title");
    const descriptionInput = document.getElementById("task-desc");
    const deadlineInput = document.getElementById("task-deadline");
    const priorityInput = document.getElementById("task-priority");
    const title = String(titleInput?.value || "").trim();
    const description = String(descriptionInput?.value || "").trim();
    const deadline = String(deadlineInput?.value || "").trim();
    const priority = String(priorityInput?.value || "Medium").trim();
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
      if(titleInput) {
        titleInput.focus();
        titleInput.classList.add('is-error');
        document.getElementById('task-title-error')?.classList.add('visible');
      }
      return;
    }

    if(taskSubmitBtn) {
      taskSubmitBtn.disabled = true;
      taskSubmitBtn.classList.add('is-loading');
    }

    try {
      const assigneePayload = getSelectedAssigneePayload();

      if (isEditMode && editingTaskId) {
        const payload = await request("/api/tasks/" + editingTaskId, {
          method: "PUT",
          body: JSON.stringify({ title, description, deadline, priority, ...assigneePayload })
        });
        const updatedTask = normalizeTask(payload.task);

        if(updatedTask) {
          tasksData = tasksData.map((task) => task.id === updatedTask.id ? updatedTask : task);
          renderTasks();
        }
      } else {
        const payload = await request("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ title, description, deadline, priority, ...assigneePayload })
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
      loadWeeklyReport();
      showToast(isEditMode ? "Task updated." : "Task created.", "success");
    } catch(err) {
      showToast(`Failed to ${isEditMode ? "save" : "create"} task. ` + err.message, "error");
    } finally {
      if(taskSubmitBtn) {
        taskSubmitBtn.disabled = false;
        taskSubmitBtn.classList.remove('is-loading');
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

if (openReminderCenterBtn && deadlineModal && closeReminderCenterBtn) {
  openReminderCenterBtn.addEventListener("click", () => {
    renderReminderCenter();
    if (!deadlineModal.open) {
      deadlineModal.showModal();
    }
  });
  closeReminderCenterBtn.addEventListener("click", () => deadlineModal.close());
}

if (openPeerRatingBtn && peerRatingModal && closePeerRatingBtn) {
  openPeerRatingBtn.addEventListener("click", async () => {
    await loadPeerRatings();
    renderPeerRatingForm();
    if (!peerRatingModal.open) {
      peerRatingModal.showModal();
    }
  });
  closePeerRatingBtn.addEventListener("click", () => peerRatingModal.close());
}

if (peerRatingForm && peerRatingSubmitBtn) {
  peerRatingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const ratingCards = document.querySelectorAll(".peer-rating-form-card");
    const ratings = Array.from(ratingCards).map((card) => {
      const ratedUserId = String(card.getAttribute("data-rated-user-id") || "").trim();
      const score = String(card.querySelector(".peer-rating-score-input")?.value || "").trim();
      const feedback = String(card.querySelector(".peer-rating-feedback-input")?.value || "").trim();
      return {
        feedback,
        ratedUserId,
        score: score ? Number(score) : null
      };
    }).filter((entry) => entry.ratedUserId && (entry.score || entry.feedback));

    if (ratings.length === 0) {
      showToast("Choose at least one teammate score before saving.", "error");
      return;
    }

    peerRatingSubmitBtn.disabled = true;
    peerRatingSubmitBtn.classList.add("is-loading");

    try {
      await request("/api/peer-ratings", {
        method: "PUT",
        body: JSON.stringify({ ratings })
      });
      await loadPeerRatings();
      await loadWeeklyReport();
      renderPeerRatingForm();
      showToast("Peer ratings saved.", "success");
      if (peerRatingModal.open) {
        peerRatingModal.close();
      }
    } catch (error) {
      showToast("Failed to save peer ratings. " + error.message, "error");
    } finally {
      peerRatingSubmitBtn.disabled = false;
      peerRatingSubmitBtn.classList.remove("is-loading");
    }
  });
}

async function copyWeeklyReportToClipboard() {
  if (!weeklyReportData?.plainText) {
    showToast("Generate the weekly report before copying it.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(weeklyReportData.plainText);
    showToast("Weekly report copied.", "success");
  } catch {
    showToast("Copy failed on this browser.", "error");
  }
}

if (openWeeklyReportBtn && weeklyReportModal && closeWeeklyReportBtn) {
  openWeeklyReportBtn.addEventListener("click", async () => {
    await loadWeeklyReport();
    renderWeeklyReportModal();
    if (!weeklyReportModal.open) {
      weeklyReportModal.showModal();
    }
  });
  closeWeeklyReportBtn.addEventListener("click", () => weeklyReportModal.close());
}

if (refreshWeeklyReportBtn) {
  refreshWeeklyReportBtn.addEventListener("click", () => loadWeeklyReport());
}

if (copyWeeklyReportBtn) {
  copyWeeklyReportBtn.addEventListener("click", () => copyWeeklyReportToClipboard());
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
    container.innerHTML = `
      <div class="chat-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4;margin-bottom:0.6rem">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <strong style="display:block;font-size:0.9rem;font-weight:700;margin-bottom:0.25rem">No messages yet</strong>
        <span style="font-size:0.8rem;opacity:0.6">Be the first to say something!</span>
      </div>`;
    renderWorkspaceOverview();
    return;
  }
  
  let html = '';
  let lastDateStr = null;

  messagesData.forEach(msg => {
    const rawDate = msg.createdAt || msg.timestamp;
    const msgDate = new Date(rawDate);
    
    let dateStr = "Unknown Date";
    if (!Number.isNaN(msgDate.getTime())) {
      dateStr = msgDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const todayStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      if (dateStr === todayStr) dateStr = "Today";
    }

    if (dateStr !== lastDateStr) {
      html += `<div class="chat-date-separator">${escapeHtml(dateStr)}</div>`;
      lastDateStr = dateStr;
    }

    html += `
      <div class="chat-message ${msg.userId === currentUser.id ? 'is-me' : ''}">
        <div class="chat-message-head">
          <strong>${escapeHtml(msg.userName || msg.name || 'Unknown')}</strong>
          <span class="chat-message-time">${formatDate(rawDate)}</span>
        </div>
        <div>${escapeHtml(msg.text || msg.content || '')}</div>
      </div>
    `;
  });

  container.innerHTML = html;

  
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
    
    {/* Mobile hamburger button */}
    <button
      className="sidebar-hamburger"
      id="sidebar-hamburger"
      aria-label="Toggle menu"
      onClick={() => {
        const sidebar = document.querySelector('.app-sidebar');
        const hamburger = document.getElementById('sidebar-hamburger');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar?.classList.toggle('is-open');
        hamburger?.classList.toggle('is-open');
        overlay?.classList.toggle('is-visible');
      }}
    >
      <span className="hamburger-line" />
      <span className="hamburger-line" />
      <span className="hamburger-line" />
    </button>

    {/* Overlay backdrop */}
    <div
      id="sidebar-overlay"
      className="sidebar-overlay"
      onClick={() => {
        const sidebar = document.querySelector('.app-sidebar');
        const hamburger = document.getElementById('sidebar-hamburger');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar?.classList.remove('is-open');
        hamburger?.classList.remove('is-open');
        overlay?.classList.remove('is-visible');
      }}
    />
    
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand" data-navigate="/">
          <img src={logoImg} alt="CollabSpace Logo" className="brand-logo" style={{ height: '32px', width: 'auto', transform: 'scale(2.5)', transformOrigin: 'left center', marginRight: '25px' }} />
          <span style={{ zIndex: 1, position: 'relative' }}>CollabSpace</span>
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
          <div>
            <h1 className="app-main-title">Team Dashboard</h1>
            <p className="app-main-subtitle" id="board-subtitle">Project Overview</p>
          </div>
          <div className="dashboard-focus-strip">
            <span className="focus-strip-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',marginRight:'5px',verticalAlign:'middle'}}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Today's Focus
            </span>
            <span id="focus-tasks-due" className="focus-strip-chip">— tasks in progress</span>
            <span id="focus-team-online" className="focus-strip-chip">— team members</span>
          </div>
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
          <div className="dashboard-panel deadline-panel">
            <div className="deadline-panel-head">
              <div>
                <h3 className="sidebar-title">Deadline Reminders</h3>
                <p id="deadline-reminder-subtitle" className="contribution-panel-copy">Tracking upcoming deadlines and overdue work.</p>
              </div>
              <button type="button" id="open-reminders-btn" className="btn btn-ghost">Open Center</button>
            </div>
            <div id="deadline-reminder-stats" className="deadline-stat-grid"></div>
            <div id="deadline-reminder-list" className="deadline-reminder-list"></div>
          </div>

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

        <div className="contribution-secondary-grid">
          <section className="dashboard-panel contribution-panel">
            <div className="contribution-panel-head contribution-panel-head-split">
              <div>
                <h2 className="board-title">Peer Rating System</h2>
                <p className="contribution-panel-copy">Collect fair teammate feedback without changing the rest of the workspace flow.</p>
              </div>
              <button type="button" id="open-peer-rating-btn" className="btn btn-primary">Rate Teammates</button>
            </div>
            <div id="peer-rating-summary"></div>
            <div id="peer-rating-list" className="peer-rating-list"></div>
          </section>

          <section className="dashboard-panel contribution-panel weekly-report-panel">
            <div className="contribution-panel-head contribution-panel-head-split">
              <div>
                <h2 className="board-title">Weekly Progress Report</h2>
                <p className="contribution-panel-copy">A one-click summary of delivery, blockers, chat activity, and peer review participation.</p>
              </div>
              <div className="feature-button-row weekly-report-actions">
                <button type="button" id="refresh-weekly-report-btn" className="btn btn-ghost">Refresh</button>
                <button type="button" id="open-weekly-report-btn" className="btn btn-primary">Open Report</button>
              </div>
            </div>
            <p id="weekly-report-period-label" className="task-lock-note weekly-report-period-kicker">Generating latest summary...</p>
            <div id="weekly-report-preview"></div>
          </section>
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
        <div id="task-title-error" className="modal-field-error">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Task title is required
        </div>
      </div>
      <div className="modal-field">
        <label>Details</label>
        <textarea className="modal-textarea" id="task-desc" rows="3"></textarea>
      </div>
      <div className="task-modal-grid">
        <div className="modal-field">
          <label>Deadline</label>
          <input className="modal-input" type="date" id="task-deadline" />
        </div>
        <div className="modal-field">
          <label>Priority</label>
          <select className="modal-select" id="task-priority" defaultValue="Medium">
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
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

  <dialog id="deadline-modal">
    <div className="modal-shell reminder-center-shell">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Reminder Center</h3>
          <p className="modal-subtitle">Track every overdue task, urgent deadline, and upcoming checkpoint across this workspace. Filter, sort, and dismiss items you've already handled.</p>
        </div>
        <button type="button" id="close-deadline-modal" className="btn btn-ghost">Close</button>
      </div>
      <div id="deadline-modal-content"></div>
    </div>
  </dialog>

  <dialog id="peer-rating-modal">
    <div className="modal-shell feature-modal-shell">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Peer Rating System</h3>
          <p className="modal-subtitle">Save 1-5 collaboration scores for each teammate. The dashboard shows team averages only, and you can revise your scores later.</p>
        </div>
        <button type="button" id="close-peer-rating-modal" className="btn btn-ghost">Close</button>
      </div>
      <form id="peer-rating-form" className="modal-form">
        <div id="peer-rating-form-list" className="peer-rating-form-list"></div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => document.getElementById('peer-rating-modal').close()}>Cancel</button>
          <button type="submit" id="peer-rating-submit-btn" className="btn btn-primary">Save Ratings</button>
        </div>
      </form>
    </div>
  </dialog>

  <dialog id="weekly-report-modal">
    <div className="modal-shell feature-modal-shell report-modal-shell">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Weekly Progress Report</h3>
          <p className="modal-subtitle">Generated from current workspace activity so you can share a clean weekly snapshot without leaving CollabSpace.</p>
        </div>
        <div className="feature-button-row">
          <button type="button" id="copy-weekly-report-btn" className="btn btn-ghost">Copy</button>
          <button type="button" id="close-weekly-report-modal" className="btn btn-ghost">Close</button>
        </div>
      </div>
      <div id="weekly-report-content"></div>
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

  {/* Command Palette (Cmd+K) */}
  <div id="cmd-backdrop" className="cmd-backdrop" onClick={(e) => {
    if (e.target.id === 'cmd-backdrop') e.target.classList.remove('is-open');
  }}>
    <div className="cmd-palette">
      <div className="cmd-input-wrap">
        <svg className="cmd-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="cmd-input" className="cmd-input" placeholder="Search tasks, teams, and members..." autoComplete="off" />
      </div>
      <div id="cmd-results" className="cmd-results">
        <div className="cmd-section-label">Quick Actions</div>
        <div className="cmd-item" onClick={() => { document.getElementById('cmd-backdrop').classList.remove('is-open'); document.getElementById('task-modal')?.showModal(); }}>
          <div className="cmd-item-icon">➕</div>
          <div className="cmd-item-text"><div className="cmd-item-name">Create new task</div></div>
        </div>
      </div>
      <div className="cmd-footer">
        <span className="cmd-shortcut"><kbd className="cmd-key">↑</kbd> <kbd className="cmd-key">↓</kbd> to navigate</span>
        <span className="cmd-shortcut"><kbd className="cmd-key">Enter</kbd> to select</span>
        <span className="cmd-shortcut"><kbd className="cmd-key">Esc</kbd> to close</span>
      </div>
    </div>
  </div>

  <script dangerouslySetInnerHTML={{__html: `
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const backdrop = document.getElementById('cmd-backdrop');
        if (backdrop) {
          backdrop.classList.toggle('is-open');
          if (backdrop.classList.contains('is-open')) {
            setTimeout(() => document.getElementById('cmd-input')?.focus(), 50);
          }
        }
      } else if (e.key === 'Escape') {
        document.getElementById('cmd-backdrop')?.classList.remove('is-open');
      }
    });
  `}} />

    </div>
  );
}
