"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  queueItemId: number;
  assignedTo?: string | null;
};

export default function WorkflowQueueActions({ queueItemId, assignedTo }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const claimed = Boolean(assignedTo);

  async function act(action: "claim" | "release") {
    try {
      setBusy(true);

      const response = await fetch(`/api/review-desk/workflow-queue/${queueItemId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          action === "claim"
            ? JSON.stringify({
                reviewerId: "TRUVERN_REVIEWER",
                reviewerName: "Truvern Reviewer",
              })
            : JSON.stringify({
                actor: "TRUVERN_REVIEWER",
              }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || `Failed to ${action} work.`);
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Workflow queue action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (claimed) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => act("release")}
        className="rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/20 disabled:opacity-50"
      >
        {busy ? "Releasing..." : "Release"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => act("claim")}
      className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
    >
      {busy ? "Claiming..." : "Claim work"}
    </button>
  );
}
