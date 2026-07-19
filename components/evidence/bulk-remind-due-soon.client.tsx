// components/evidence/bulk-remind-due-soon.client.tsx
"use client";

import { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Preview = {
  ok: boolean;
  dryRun: boolean;
  totals?: {
    fetched: number;
    sentOrWouldSend: number;
    skippedClosed: number;
    skippedThrottled: number;
    skippedNoEmail: number;
    errors: number;
  };
  preview?: {
    eligibleNow: number;
    wouldBeThrottled: number;
  } | null;
  errors?: Array<{ id: number; error: string }>;
};

export default function BulkRemindDueSoonButton({
  days = 7,
  limit = 200,
  className,
}: {
  days?: number;
  limit?: number;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const summary = useMemo(() => {
    if (!preview?.ok) return null;
    const p = preview.preview;
    const t = preview.totals;
    if (!t) return null;
    return {
      eligibleNow: p?.eligibleNow ?? 0,
      wouldBeThrottled: p?.wouldBeThrottled ?? 0,
      wouldSend: t.sentOrWouldSend ?? 0,
      fetched: t.fetched ?? 0,
    };
  }, [preview]);

  async function runDry() {
    setMsg(null);
    setLoading(true);
    setConfirming(false);
    try {
      const body = JSON.stringify({ days, limit, dryRun: true });
      const res = await fetch(`/api/evidence-requests/remind-due-soon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const json = (await res.json().catch(() => null)) as any;

      if (!res.ok || !json?.ok) {
        setMsg(json?.error || "Preview failed.");
        setPreview(null);
        return;
      }
      setPreview(json);
      setConfirming(true);
      setMsg("Preview ready.");
    } catch (e: any) {
      setMsg(e?.message || "Preview failed.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  async function runSend() {
    setMsg(null);
    setLoading(true);
    try {
      const body = JSON.stringify({ days, limit, dryRun: false });
      const res = await fetch(`/api/evidence-requests/remind-due-soon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const json = (await res.json().catch(() => null)) as any;

      if (!res.ok || !json?.ok) {
        setMsg(json?.error || "Send failed.");
        return;
      }

      const count = json?.totals?.sentOrWouldSend ?? 0;
      setMsg(`Sent ${count} reminder(s).`);
      setConfirming(false);
      setPreview(null);
    } catch (e: any) {
      setMsg(e?.message || "Send failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={runDry}
        disabled={loading}
        className={clsx("btn-glass h-9 px-3 text-sm", loading && "opacity-60 pointer-events-none")}
        title="Preview reminders due within the next 7 days"
      >
        {loading ? "Working€¦" : "Remind due soon (7d)"}
      </button>

      {confirming && summary ? (
        <div className="flex items-center gap-2">
          <div className="text-xs opacity-80">
            Would send: <b>{summary.wouldSend}</b> €¢ Eligible now: <b>{summary.eligibleNow}</b> €¢ Throttled:{" "}
            <b>{summary.wouldBeThrottled}</b>
          </div>
          <button
            type="button"
            onClick={runSend}
            disabled={loading}
            className={clsx("btn-primary h-9 px-3 text-sm", loading && "opacity-60 pointer-events-none")}
            title="Send reminders now"
          >
            Confirm send
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setPreview(null);
              setMsg(null);
            }}
            disabled={loading}
            className={clsx("btn-glass h-9 px-3 text-sm", loading && "opacity-60 pointer-events-none")}
            title="Cancel"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {msg ? <span className="text-xs opacity-75">{msg}</span> : null}
    </div>
  );
}


