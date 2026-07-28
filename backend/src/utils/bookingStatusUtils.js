const TERMINAL_STATUSES = [
  "completed",
  "cancelled",
  "no-show",
  "missed",
  "blocked",
];

const CANCELLABLE_STATUSES = ["upcoming", "pending", "checked-in"];

const ALLOWED_TRANSITIONS = {
  pending: ["upcoming", "cancelled", "no-show"],
  upcoming: ["checked-in", "cancelled", "no-show"],
  "checked-in": ["completed", "cancelled", "no-show"],
  blocked: [],
  completed: [],
  cancelled: [],
  "no-show": [],
  missed: [],
};

const isTerminalStatus = (status) => TERMINAL_STATUSES.includes(status);

const isCancellableStatus = (status) => CANCELLABLE_STATUSES.includes(status);

const canTransitionStatus = (fromStatus, toStatus) => {
  if (fromStatus === toStatus) return true;
  if (isTerminalStatus(fromStatus)) return false;
  if (toStatus === "completed" && fromStatus !== "checked-in") return false;
  return (ALLOWED_TRANSITIONS[fromStatus] || []).includes(toStatus);
};

const getTransitionError = (fromStatus, toStatus) => {
  if (fromStatus === toStatus) return null;
  if (isTerminalStatus(fromStatus)) {
    return `Cannot change status from ${fromStatus}.`;
  }
  if (toStatus === "completed" && fromStatus !== "checked-in") {
    return "Booking must be checked in before marking completed.";
  }
  if (!canTransitionStatus(fromStatus, toStatus)) {
    return `Cannot change status from ${fromStatus} to ${toStatus}.`;
  }
  return null;
};

const isInactiveBookingStatus = (status) =>
  ["cancelled", "completed", "no-show", "missed"].includes(status);

module.exports = {
  TERMINAL_STATUSES,
  CANCELLABLE_STATUSES,
  isTerminalStatus,
  isCancellableStatus,
  canTransitionStatus,
  getTransitionError,
  isInactiveBookingStatus,
};
