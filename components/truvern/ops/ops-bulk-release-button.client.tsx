"use client";

import { useState } from "react";

type Props = {
  assignmentIds: number[];
};

export default function OpsBulkReleaseButton({ assignmentIds }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function releaseAll() {
    if (!assignmentIds.length || busy) return;

    const ok = window.confirm(
      `Release ${assignmentIds.length} completed Truvern review${
        assignmentIds.length === 1 ? "" : "s"
      }?`,
    );

    if (!ok) return;

    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/review-desk/reviews/bulk-release", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignmentIds }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Bulk release failed.");
      }

      setMessage(
        `Released ${data.released ?? 0}. Skipped ${
          (data.skippedAlreadyReleased ?? 0) +
          (data.skippedNotCompleted ?? 0) +
          (data.skippedNoOutcome ?? 0)
        }.`,
      );

      window.location.reload();
    } catch (error: any) {
      setMessage(error?.message || "Bulk release failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={!assignmentIds.length || busy}
        onClick={releaseAll}
        className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Releasing..." : `FAST RELEASE ${assignmentIds.length}`}
      </button>

      {message ? (
        <p className="max-w-xs text-right text-xs text-slate-400">{message}</p>
      ) : null}
    </div>
  );
}

