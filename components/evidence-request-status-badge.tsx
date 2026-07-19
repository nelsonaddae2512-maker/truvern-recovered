// components/evidence-request-status-badge.tsx
import React from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  status: string;
  dueAt?: Date | string | null;
  className?: string;
  showCriticalWhenOverdue?: boolean; // default true
};

function isOpenStatus(status: string) {
  const s = (status || "").toUpperCase();
  // treat these as "still active / needs attention"
  return !["APPROVED", "REJECTED", "CANCELLED", "FULFILLED", "COMPLETED"].includes(s);
}

function badgeBase() {
  return "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border";
}

function statusStyle(status: string) {
  const s = (status || "").toUpperCase();
  if (s === "APPROVED") return "bg-emerald-500/10 text-emerald-200 border-emerald-500/20";
  if (s === "REJECTED") return "bg-rose-500/10 text-rose-200 border-rose-500/20";
  if (s === "SUBMITTED") return "bg-sky-500/10 text-sky-200 border-sky-500/20";
  if (s === "IN_PROGRESS") return "bg-amber-500/10 text-amber-200 border-amber-500/20";
  if (s === "REQUESTED") return "bg-slate-500/10 text-slate-200 border-slate-500/20";
  return "bg-slate-500/10 text-slate-200 border-slate-500/20";
}

export default function EvidenceRequestStatusBadge({
  status,
  dueAt,
  className,
  showCriticalWhenOverdue = true,
}: Props) {
  const now = Date.now();
  const dueMs = dueAt ? new Date(dueAt as any).getTime() : null;
  const overdue = Boolean(
    showCriticalWhenOverdue && dueMs && Number.isFinite(dueMs) && dueMs < now && isOpenStatus(status)
  );

  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      {overdue && (
        <span
          className={clsx(
            badgeBase(),
            "bg-rose-600/20 text-rose-100 border-rose-500/30"
          )}
          title="This request is past due"
        >
          CRITICAL
        </span>
      )}

      <span className={clsx(badgeBase(), statusStyle(status))}>{status}</span>
    </span>
  );
}


