// components/evidence/send-reminder-button.client.tsx
"use client";

import { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function isOpenStatus(status: string) {
  const s = (status || "").toUpperCase();
  return !["APPROVED", "REJECTED", "CANCELLED", "FULFILLED", "COMPLETED"].includes(s);
}

export default function SendReminderButton({
  requestId,
  status,
  className,
}: {
  requestId: number;
  status: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canRemind = useMemo(() => isOpenStatus(status), [status]);

  async function onClick() {
    if (!canRemind) return;

    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/evidence-requests/${requestId}/remind`, { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        if (json?.throttled) {
          setMsg(`Sent recently. Try again in ~${json.minutesUntilAllowed}m.`);
        } else {
          setMsg(json?.error || "Failed to send.");
        }
        return;
      }

      setMsg("Reminder sent.");
      setTimeout(() => setMsg(null), 2500);
    } catch (e: any) {
      setMsg(e?.message || "Failed to send.");
    } finally {
      setLoading(false);
    }
  }

  // Hide for closed statuses (APPROVED/REJECTED/etc.)
  if (!canRemind) {
    return <div className={clsx("text-right text-xs opacity-50", className)}>€”</div>;
  }

  return (
    <div className={clsx("flex items-center justify-end gap-2", className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={clsx("btn-glass", "h-8 px-3 text-xs", loading && "opacity-60 pointer-events-none")}
        title="Send reminder email to vendor contact"
      >
        {loading ? "Sending€¦" : "Send Reminder"}
      </button>
      {msg ? <span className="text-xs opacity-70 whitespace-nowrap">{msg}</span> : null}
    </div>
  );
}


