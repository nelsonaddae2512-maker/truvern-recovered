// components/evidence/evidence-due-countdown.client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtDelta(ms: number) {
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const chunks: string[] = [];
  if (days) chunks.push(`${days}d`);
  if (hrs || days) chunks.push(`${hrs}h`);
  chunks.push(`${mins}m`);
  chunks.push(`${secs}s`);
  return chunks.join(" ");
}

export default function EvidenceDueCountdown({
  dueAt,
  className,
}: {
  dueAt?: Date | string | null;
  className?: string;
}) {
  const dueMs = useMemo(() => (dueAt ? new Date(dueAt as any).getTime() : null), [dueAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!dueMs || !Number.isFinite(dueMs)) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [dueMs]);

  if (!dueMs || !Number.isFinite(dueMs)) return <span className={clsx("text-sm opacity-60", className)}>€”</span>;

  const delta = dueMs - now;
  const overdue = delta < 0;

  // soft urgency thresholds
  const absHours = Math.abs(delta) / 36e5;
  const soon = !overdue && absHours <= 72;

  return (
    <span
      className={clsx(
        "text-xs",
        overdue ? "text-rose-200" : soon ? "text-amber-200" : "text-slate-200/80",
        className
      )}
      title={new Date(dueMs).toLocaleString()}
    >
      {overdue ? `Overdue by ${fmtDelta(delta)}` : `Due in ${fmtDelta(delta)}`}
    </span>
  );
}



