// lib/issue-sla.ts

export type IssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Default SLA targets (days) by severity.
 * Adjust anytime without schema changes.
 */
export function slaDays(severity: IssueSeverity): number {
  switch (severity) {
    case "CRITICAL":
      return 14;
    case "HIGH":
      return 30;
    case "MEDIUM":
      return 60;
    case "LOW":
    default:
      return 90;
  }
}

export function computeDueAt(severity: IssueSeverity, openedAt?: Date): Date {
  const base = openedAt ?? new Date();
  const days = slaDays(severity);
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function isOpenStatus(status: string | null | undefined) {
  return status === "OPEN" || status === "IN_REVIEW";
}

export function isOverdue(dueAt?: Date | string | null, status?: string | null) {
  if (!dueAt) return false;
  if (status && !isOpenStatus(status)) return false;
  const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  return d.getTime() < Date.now();
}



