const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

function isArchivedTask(task) {
  return Boolean(String(task?.archivedAt || "").trim());
}

function isTaskComplete(task) {
  return (
    isArchivedTask(task) ||
    normalizeTaskStatus(task?.status) === "Done" ||
    Boolean(String(task?.completedAt || "").trim())
  );
}

function taskBelongsToTeam(task, team) {
  if (!task || !team) {
    return false;
  }

  return task.teamId === team.id || task.teamName === team.name;
}

function parseTimestamp(value) {
  const parsed = Date.parse(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDeadlineTimestamp(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      23,
      59,
      59,
      999
    ).getTime();
  }

  return parseTimestamp(text);
}

function normalizeRatingScore(score) {
  const numericScore = Number(score);
  if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
    return null;
  }

  return numericScore;
}

function roundToSingleDecimal(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function averageScore(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const sum = values.reduce((total, value) => total + Number(value || 0), 0);
  return roundToSingleDecimal(sum / values.length);
}

function getTaskAssigneeNames(task, teamMembers = []) {
  if (Array.isArray(task?.assignees) && task.assignees.length > 0) {
    const names = task.assignees
      .map((assignee) => String(assignee?.name || "").trim())
      .filter(Boolean);

    if (names.length > 0) {
      return names;
    }
  }

  const assigneeName = String(task?.assignee || "").trim();
  if (assigneeName) {
    return [assigneeName];
  }

  const assigneeId = String(task?.assigneeId || "").trim();
  if (assigneeId) {
    const teamMember = teamMembers.find((member) => member.userId === assigneeId);
    if (teamMember?.name) {
      return [String(teamMember.name).trim()];
    }
  }

  return [];
}

function isTaskAssignedToMember(task, member) {
  if (!task || !member) {
    return false;
  }

  if (
    Array.isArray(task.assignees) &&
    task.assignees.some((assignee) => assignee?.id === member.userId)
  ) {
    return true;
  }

  const assigneeId = String(task.assigneeId || "").trim();
  const assigneeName = String(task.assignee || "").trim();

  return (
    assigneeId === String(member.userId || "").trim() ||
    assigneeName === String(member.name || "").trim()
  );
}

function formatDisplayDate(value) {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return "";
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDisplayDateTime(value) {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return "";
  }

  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDueLabel(deadlineValue, nowTs) {
  const deadlineTs = parseDeadlineTimestamp(deadlineValue);
  if (!deadlineTs) {
    return "No due date";
  }

  const diffMs = deadlineTs - nowTs;
  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

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

  return `Due ${formatDisplayDate(deadlineValue)}`;
}

export function buildTeamPeerRatingSnapshot(team, ratings, currentUserId = "") {
  const members = Array.isArray(team?.members) ? team.members : [];
  const memberIds = new Set(
    members
      .map((member) => String(member?.userId || "").trim())
      .filter(Boolean)
  );
  const currentUserRatings = {};

  const relevantRatings = (Array.isArray(ratings) ? ratings : [])
    .map((rating) => {
      const normalizedScore = normalizeRatingScore(rating?.score);
      if (!normalizedScore) {
        return null;
      }

      return {
        ...rating,
        feedback: String(rating?.feedback || "").replace(/\s+/g, " ").trim(),
        ratedUserId: String(rating?.ratedUserId || "").trim(),
        raterId: String(rating?.raterId || "").trim(),
        score: normalizedScore,
        teamId: String(rating?.teamId || "").trim()
      };
    })
    .filter(Boolean)
    .filter((rating) => {
      return (
        rating.teamId === String(team?.id || "").trim() &&
        memberIds.has(rating.ratedUserId) &&
        memberIds.has(rating.raterId) &&
        rating.ratedUserId !== rating.raterId
      );
    });

  const ratingsByTarget = new Map();
  const participation = new Set();

  relevantRatings.forEach((rating) => {
    const existing = ratingsByTarget.get(rating.ratedUserId) || [];
    existing.push(rating);
    ratingsByTarget.set(rating.ratedUserId, existing);
    participation.add(rating.raterId);

    if (rating.raterId === String(currentUserId || "").trim()) {
      currentUserRatings[rating.ratedUserId] = {
        feedback: rating.feedback,
        score: rating.score,
        updatedAt: String(rating.updatedAt || rating.createdAt || "").trim()
      };
    }
  });

  const memberSummaries = members.map((member) => {
    const memberRatings = ratingsByTarget.get(member.userId) || [];
    return {
      averageScore: averageScore(memberRatings.map((rating) => rating.score)),
      name: String(member.name || "Unnamed teammate").trim(),
      reviewCount: memberRatings.length,
      role: String(member.role || "Member").trim() || "Member",
      userId: String(member.userId || "").trim()
    };
  });

  return {
    currentUserRatings,
    members: memberSummaries,
    summary: {
      eligibleRaters: members.length,
      participationCount: participation.size,
      teamAverageScore: averageScore(
        relevantRatings.map((rating) => rating.score)
      ),
      totalRatings: relevantRatings.length
    }
  };
}

export function buildWeeklyProgressReport({
  messages = [],
  now = new Date(),
  ratings = [],
  tasks = [],
  team
}) {
  const safeNow = now instanceof Date ? now : new Date(now);
  const nowTs = safeNow.getTime();
  const windowStartTs = nowTs - WEEK_MS;
  const members = Array.isArray(team?.members) ? team.members : [];
  const peerSnapshot = buildTeamPeerRatingSnapshot(team, ratings);

  const teamTasks = (Array.isArray(tasks) ? tasks : []).filter((task) =>
    taskBelongsToTeam(task, team)
  );
  const teamMessages = (Array.isArray(messages) ? messages : []).filter(
    (message) =>
      message.teamId === team?.id || message.teamName === team?.name
  );

  const createdThisWeek = teamTasks.filter((task) => {
    const createdAtTs = parseTimestamp(task?.createdAt);
    return createdAtTs !== null && createdAtTs >= windowStartTs;
  });

  const completedThisWeek = teamTasks.filter((task) => {
    if (!isTaskComplete(task)) {
      return false;
    }

    const completedAtTs = parseTimestamp(
      task?.completedAt || task?.archivedAt || task?.updatedAt
    );

    return completedAtTs !== null && completedAtTs >= windowStartTs;
  });

  const openTasks = teamTasks.filter((task) => !isTaskComplete(task));
  const overdueTasks = openTasks.filter((task) => {
    const deadlineTs = parseDeadlineTimestamp(task?.deadline);
    return deadlineTs !== null && deadlineTs < nowTs;
  });
  const dueSoonTasks = openTasks.filter((task) => {
    const deadlineTs = parseDeadlineTimestamp(task?.deadline);
    return deadlineTs !== null && deadlineTs >= nowTs && deadlineTs <= nowTs + WEEK_MS;
  });
  const messagesThisWeek = teamMessages.filter((message) => {
    const messageTs = parseTimestamp(message?.createdAt || message?.timestamp);
    return messageTs !== null && messageTs >= windowStartTs;
  });
  const peerReviewsThisWeek = (Array.isArray(ratings) ? ratings : []).filter(
    (rating) => {
      const updatedAtTs = parseTimestamp(
        rating?.updatedAt || rating?.createdAt
      );
      return (
        rating?.teamId === team?.id &&
        updatedAtTs !== null &&
        updatedAtTs >= windowStartTs
      );
    }
  );

  const completionRate =
    teamTasks.length > 0
      ? Math.round((completedThisWeek.length / teamTasks.length) * 100)
      : 0;
  const summaryHeadline = teamTasks.length === 0
    ? "No project activity has been recorded for this workspace yet."
    : `${completedThisWeek.length} task${completedThisWeek.length === 1 ? "" : "s"} closed, ${createdThisWeek.length} opened, and ${openTasks.length} still active this week.`;

  const highlights = completedThisWeek
    .slice()
    .sort((left, right) => {
      return (
        (parseTimestamp(right.completedAt || right.archivedAt || right.updatedAt) || 0) -
        (parseTimestamp(left.completedAt || left.archivedAt || left.updatedAt) || 0)
      );
    })
    .slice(0, 5)
    .map((task) => ({
      assignees: getTaskAssigneeNames(task, members),
      completedAt: formatDisplayDateTime(
        task.completedAt || task.archivedAt || task.updatedAt
      ),
      title: String(task.title || "Untitled task").trim()
    }));

  const attention = [...overdueTasks, ...dueSoonTasks]
    .slice()
    .sort((left, right) => {
      return (
        (parseDeadlineTimestamp(left.deadline) || Number.MAX_SAFE_INTEGER) -
        (parseDeadlineTimestamp(right.deadline) || Number.MAX_SAFE_INTEGER)
      );
    })
    .slice(0, 5)
    .map((task) => ({
      assignees: getTaskAssigneeNames(task, members),
      dueLabel: formatDueLabel(task.deadline, nowTs),
      status: normalizeTaskStatus(task.status),
      title: String(task.title || "Untitled task").trim()
    }));

  const memberBreakdown = members
    .map((member) => {
      const completedByMemberThisWeek = completedThisWeek.filter((task) =>
        isTaskAssignedToMember(task, member)
      ).length;
      const activeAssignments = openTasks.filter((task) =>
        isTaskAssignedToMember(task, member)
      ).length;
      const createdByMemberThisWeek = createdThisWeek.filter(
        (task) => String(task.createdBy || "").trim() === member.userId
      ).length;
      const ratingSummary = peerSnapshot.members.find(
        (candidate) => candidate.userId === member.userId
      );

      return {
        activeAssignments,
        averagePeerRating: ratingSummary?.averageScore || 0,
        completedThisWeek: completedByMemberThisWeek,
        createdThisWeek: createdByMemberThisWeek,
        name: String(member.name || "Unnamed teammate").trim(),
        reviewCount: ratingSummary?.reviewCount || 0,
        role: String(member.role || "Member").trim() || "Member",
        userId: String(member.userId || "").trim()
      };
    })
    .sort((left, right) => {
      return (
        right.completedThisWeek - left.completedThisWeek ||
        right.activeAssignments - left.activeAssignments ||
        left.name.localeCompare(right.name)
      );
    });

  const projectDeadlineTs = parseDeadlineTimestamp(team?.deadline);
  const projectDeadline = projectDeadlineTs
    ? {
        isOverdue: projectDeadlineTs < nowTs,
        label: formatDisplayDate(team.deadline),
        raw: String(team.deadline || "").trim()
      }
    : null;

  const report = {
    attention,
    generatedAt: safeNow.toISOString(),
    highlights,
    memberBreakdown,
    periodLabel: `${formatDisplayDate(new Date(windowStartTs).toISOString())} - ${formatDisplayDate(safeNow.toISOString())}`,
    projectDeadline,
    summary: {
      activeTasks: openTasks.length,
      chatMessagesThisWeek: messagesThisWeek.length,
      completedThisWeek: completedThisWeek.length,
      completionRate,
      createdThisWeek: createdThisWeek.length,
      dueSoonCount: dueSoonTasks.length,
      headline: summaryHeadline,
      overdueCount: overdueTasks.length,
      peerRatingAverage: peerSnapshot.summary.teamAverageScore,
      peerReviewsThisWeek: peerReviewsThisWeek.length,
      ratingParticipationCount: peerSnapshot.summary.participationCount,
      totalRatings: peerSnapshot.summary.totalRatings
    },
    teamName: String(team?.projectTitle || team?.name || "Workspace").trim()
  };

  report.plainText = buildWeeklyReportText(report);
  return report;
}

function buildWeeklyReportText(report) {
  const lines = [
    `Weekly Progress Report: ${report.teamName}`,
    `Reporting Window: ${report.periodLabel}`,
    "",
    `Summary: ${report.summary.headline}`,
    `Created This Week: ${report.summary.createdThisWeek}`,
    `Completed This Week: ${report.summary.completedThisWeek}`,
    `Active Tasks: ${report.summary.activeTasks}`,
    `Overdue Tasks: ${report.summary.overdueCount}`,
    `Due This Week: ${report.summary.dueSoonCount}`,
    `Chat Messages This Week: ${report.summary.chatMessagesThisWeek}`,
    `Peer Rating Average: ${report.summary.peerRatingAverage > 0 ? `${report.summary.peerRatingAverage}/5` : "No ratings yet"}`,
    `Peer Review Participation: ${report.summary.ratingParticipationCount}`,
    ""
  ];

  if (report.projectDeadline?.label) {
    lines.push(
      `Project Deadline: ${report.projectDeadline.label}${report.projectDeadline.isOverdue ? " (overdue)" : ""}`,
      ""
    );
  }

  lines.push("Recent Wins:");
  if (report.highlights.length === 0) {
    lines.push("- No completed tasks were recorded in this window.");
  } else {
    report.highlights.forEach((item) => {
      const assigneeLabel =
        item.assignees.length > 0 ? ` (${item.assignees.join(", ")})` : "";
      lines.push(`- ${item.title}${assigneeLabel} - ${item.completedAt || "completed recently"}`);
    });
  }

  lines.push("", "Needs Attention:");
  if (report.attention.length === 0) {
    lines.push("- No urgent blockers are flagged right now.");
  } else {
    report.attention.forEach((item) => {
      const assigneeLabel =
        item.assignees.length > 0 ? ` (${item.assignees.join(", ")})` : "";
      lines.push(`- ${item.title}${assigneeLabel} - ${item.dueLabel}`);
    });
  }

  lines.push("", "Member Breakdown:");
  if (report.memberBreakdown.length === 0) {
    lines.push("- No team members found.");
  } else {
    report.memberBreakdown.forEach((member) => {
      const ratingLabel =
        member.averagePeerRating > 0
          ? `${member.averagePeerRating}/5 from ${member.reviewCount} review${member.reviewCount === 1 ? "" : "s"}`
          : "No peer ratings yet";
      lines.push(
        `- ${member.name} (${member.role}): ${member.completedThisWeek} completed this week, ${member.activeAssignments} active, ${ratingLabel}.`
      );
    });
  }

  return lines.join("\n");
}

export { parseDeadlineTimestamp };
