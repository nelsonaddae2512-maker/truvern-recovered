"use client";

import { useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  requestId: number;
  status: string;
  className?: string;
  onUpdated?: () => void | Promise<void>;
};

export default function OrgEvidenceRequestReviewPanel({
  requestId,
  status,
  className,
  onUpdated,
}: Props) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const canReview = String(status || "").toUpperCase() === "SUBMITTED";

  async function call(action: "approve" | "reject") {
    setMsg(null);
    setBusy(action);

    const reviewNote = String(note || "").trim();

    try {
      const res = await fetch(`/api/evidence-requests/${requestId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(reviewNote ? { "x-review-note": reviewNote } : {}),
        },
        body: JSON.stringify(reviewNote ? { reviewNote } : {}),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      setMsg(
        data?.noteUpdated
          ? "Saved note."
          : action === "approve"
            ? "Approved."
            : "Rejected."
      );

      setNote("");
      await onUpdated?.();
    } catch (e: any) {
      setMsg(e?.message || "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={clsx("glass-soft rounded-2xl p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Org review</div>
          <div className="text-xs text-white/70">
            {canReview ? "Approve or reject the latest vendor submission." : "Not currently reviewable."}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs text-white/70 mb-1">Reviewer note (optional)</label>
        <input
          className="input-glass w-full"
          placeholder="Reason / guidance€¦"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="mt-3 flex gap-2 items-center">
        <button
          type="button"
          className={clsx("btn-primary", !canReview && "opacity-60 pointer-events-none")}
          onClick={() => call("approve")}
          disabled={busy !== null || !canReview}
        >
          {busy === "approve" ? "Approving€¦" : "Approve"}
        </button>

        <button
          type="button"
          className={clsx("btn-glass", !canReview && "opacity-60 pointer-events-none")}
          onClick={() => call("reject")}
          disabled={busy !== null || !canReview}
        >
          {busy === "reject" ? "Rejecting€¦" : "Reject"}
        </button>

        {msg ? <div className="ml-auto text-xs text-white/70">{msg}</div> : null}
      </div>
    </div>
  );
}



