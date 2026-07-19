"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  taskId: number;
  status: string;
  assignedTo?: string | null;
};

export default function WorkflowTaskActions({ taskId, status, assignedTo }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function post(action: "claim" | "complete") {
    try {
      setBusy(true);

      const response = await fetch(`/api/review-desk/workflow-tasks/${taskId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          action === "claim"
            ? JSON.stringify({
                reviewerId: "TRUVERN_REVIEWER",
                reviewerName: "Truvern Reviewer",
              })
            : JSON.stringify({
                result: "COMPLETED",
                notes: "Task completed from workflow task queue.",
              }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || `Failed to ${action} task.`);
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Task action failed.");
    } finally {
      setBusy(false);
    }
  }

  const completed = status === "COMPLETED";

  return (
    <div className="flex flex-wrap gap-2">
      {!assignedTo && !completed ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => post("claim")}
          className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
        >
          {busy ? "Claiming..." : "Claim task"}
        </button>
      ) : null}

      {assignedTo && !completed ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => post("complete")}
          className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-50"
        >
          {busy ? "Completing..." : "Complete task"}
        </button>
      ) : null}
    </div>
  );
}
