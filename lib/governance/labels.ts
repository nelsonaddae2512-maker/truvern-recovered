export function governanceLabel(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) return "";

  const normalized = raw.toUpperCase().replace(/[\s-]+/g, "_");

  const labels: Record<string, string> = {
    APPROVE: "Approve",
    APPROVED: "Approved",
    APPROVE_WITH_CONDITIONS: "Approve with Conditions",
    REJECT: "Reject",
    REJECTED: "Rejected",
    ESCALATE: "Escalate",
    PENDING: "Pending",

    DRAFT: "Draft",
    RELEASED: "Released",
    CONFIRMED: "Confirmed",
    RELEASE_READY: "Release Ready",
    AWAITING_CONFIRMATION: "Awaiting Confirmation",
    AWAITING_CUSTOMER_CONFIRMATION: "Awaiting Customer Confirmation",

    NOT_STARTED: "Not Started",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    REQUESTED: "Requested",
    SUBMITTED: "Submitted",
    OPEN: "Open",
    CLOSED: "Closed",

    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    CRITICAL: "Critical",
  };

  if (labels[normalized]) return labels[normalized];

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

