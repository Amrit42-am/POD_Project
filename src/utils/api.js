export async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || "Something went wrong.");
  }

  return payload;
}

export function escapeHtml(unsafe) {
  return String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatFullDate(isoString) {
  if (!isoString) return "No date";
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function initialsFor(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function normalizeTaskStatus(status) {
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

export function isArchivedTask(task) {
  return Boolean(String(task?.archivedAt || "").trim());
}

export function normalizeTask(task) {
  return {
    ...task,
    status: normalizeTaskStatus(task?.status),
    priority: String(task?.priority || "medium").trim()
  };
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function formatRelativeTime(isoString) {
  const time = Date.parse(isoString);
  if (!Number.isFinite(time)) return "";

  const diffMs = Date.now() - time;
  const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "just now";
}
