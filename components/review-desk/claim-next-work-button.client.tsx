"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ClaimNextWorkButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function claimNext() {
    try {
      setBusy(true);

      const response = await fetch("/api/review-desk/workflow-queue/claim-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerId: "TRUVERN_REVIEWER",
          reviewerName: "Truvern Reviewer",
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "No work available.");
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to claim next work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={claimNext}
      disabled={busy}
      className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
    >
      {busy ? "Claiming..." : "Claim next priority work"}
    </button>
  );
}
