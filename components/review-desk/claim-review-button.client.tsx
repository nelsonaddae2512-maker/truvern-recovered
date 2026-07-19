"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  assignmentId: number;
};

export default function ClaimReviewButton({ assignmentId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [claimedBy, setClaimedBy] = useState("");

  async function claimReview(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (busy) return;

    setBusy(true);
    setError("");
    setClaimedBy("");

    try {
      const res = await fetch(`/api/review-desk/reviews/${assignmentId}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to claim review");
      }

      setClaimedBy(json.assignedReviewerName || "Internal reviewer");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={claimReview}
        disabled={busy || Boolean(claimedBy)}
        className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Claiming..." : claimedBy ? "Claimed" : "Claim review"}
      </button>

      {claimedBy ? (
        <p className="text-xs text-emerald-200">Claimed by {claimedBy}</p>
      ) : null}

      {error ? <p className="text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
