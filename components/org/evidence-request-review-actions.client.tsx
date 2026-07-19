// components/org/evidence-request-review-actions.client.tsx
"use client";

import { useMemo, useState, useTransition } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function postJson(url: string, body: any): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      `Request failed (${res.status} ${res.statusText})`;
    throw new Error(msg);
  }

  return data;
}

export default function EvidenceRequestReviewActions({
  requestId,
  status,
  initialReviewNote,
  canReview,
  isWaiting,
  isFinal,
  onRevalidate,
  showExport = true, // kept for compatibility with callers; page sets false to avoid duplicates
}: {
  requestId: number;
  status: string;
  initialReviewNote: string;
  canReview: boolean;
  isWaiting: boolean;
  isFinal: boolean;
  onRevalidate?: () => void | Promise<void>;
  showExport?: boolean;
}) {
  const [note, setNote] = useState(initialReviewNote || "");
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const s = useMemo(() => String(status || "").toUpperCase(), [status]);

  // When actions are disabled, show the reason AND make UI read-only
  const disabledReason = useMemo(() => {
    if (pending) return "Working€¦";
    if (isWaiting) return "Waiting for vendor submission.";
    if (isFinal) return "This request is finalized.";
    if (!canReview) return "Review actions are unavailable for this view.";
    return "";
  }, [pending, isWaiting, isFinal, canReview]);

  const canAct = !pending && canReview && !isWaiting && !isFinal;

  async function run(action: "approve" | "reject") {
    setMsg("");
    setErr("");

    startTransition(async () => {
      try {
        const url = `/api/evidence-requests/${requestId}/${action}`;
        const payload = { reviewNote: note || "" };
        await postJson(url, payload);

        setMsg(action === "approve" ? "Approved." : "Rejected.");
        if (onRevalidate) await onRevalidate();
      } catch (e: any) {
        setErr(e?.message || "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* IMPORTANT: Export UI must NEVER render here when showExport={false}. */}
      {/* This prevents the duplicate Print/Export button inside the Submission card. */}
      {showExport ? null : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">Review</div>
            <div className="mt-1 text-xs text-white/60">
              Status: <span className="text-white/80 font-semibold">{s || "€”"}</span>
            </div>
          </div>

          {disabledReason ? (
            <div className="text-xs text-white/60">{disabledReason}</div>
          ) : null}
        </div>

        <label className="mt-3 block">
          <div className="text-xs font-semibold text-white/70">Reviewer note</div>
          <textarea
            className={clsx(
              "mt-2 w-full min-h-[96px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90",
              "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/10",
              !canAct && "opacity-90"
            )}
            placeholder="Add a reviewer note (optional). This will be stored for audit."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!canAct}
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={clsx(
              "btn-primary",
              (!canAct || pending) && "opacity-60 pointer-events-none"
            )}
            onClick={() => run("approve")}
            title={!canAct ? disabledReason : "Approve this submission"}
            aria-disabled={!canAct}
            disabled={!canAct}
          >
            {pending ? "Working€¦" : "Approve"}
          </button>

          <button
            type="button"
            className={clsx(
              "btn-glass",
              (!canAct || pending) && "opacity-60 pointer-events-none"
            )}
            onClick={() => run("reject")}
            title={!canAct ? disabledReason : "Reject this submission"}
            aria-disabled={!canAct}
            disabled={!canAct}
          >
            {pending ? "Working€¦" : "Reject"}
          </button>

          {msg ? <div className="ml-1 text-sm text-emerald-200">{msg}</div> : null}
          {err ? <div className="ml-1 text-sm text-rose-200">{err}</div> : null}
        </div>

        {!canReview && !isWaiting && !isFinal ? (
          <div className="mt-2 text-xs text-white/55">
            Tip: review actions are locked unless you€™re viewing the latest submitted iteration.
          </div>
        ) : null}
      </div>
    </div>
  );
}



