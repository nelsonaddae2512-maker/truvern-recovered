"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  taskId: number;
  status: string;
  assignedTo?: string | null;
  type: string;
  packageId?: number | null;
};

export default function WorkflowTaskActions({
  taskId,
  status,
  assignedTo,
  type,
  packageId,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function postTask(action: "claim" | "complete") {
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

  async function postPackageDecision(
    action: "approve" | "request-more-info",
  ) {
    if (!packageId) {
      alert("This package decision task is missing its remediation package.");
      return;
    }

    const confirmed =
      action === "approve"
        ? window.confirm(
            "Approve this remediation package and run release-readiness checks?",
          )
        : window.confirm(
            "Request more information from the vendor for this remediation package?",
          );

    if (!confirmed) {
      return;
    }

    try {
      setBusy(true);

      const response = await fetch(
        `/api/review-desk/remediation-packages/${packageId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body:
            action === "approve"
              ? JSON.stringify({})
              : JSON.stringify({
                  summary:
                    "Reviewer requested more information from the workflow task queue.",
                  comment:
                    "Additional remediation information or evidence is required before package approval.",
                  reviewerName: "Truvern Reviewer",
                }),
        },
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            (action === "approve"
              ? "Failed to approve remediation package."
              : "Failed to request more information."),
        );
      }

      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Package decision failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const completed = status === "COMPLETED";
  const packageDecision = type === "PACKAGE_DECISION";

  return (
    <div className="flex flex-wrap gap-2">
      {!assignedTo && !completed ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => postTask("claim")}
          className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
        >
          {busy ? "Claiming..." : "Claim task"}
        </button>
      ) : null}

      {assignedTo && !completed && !packageDecision ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => postTask("complete")}
          className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-50"
        >
          {busy ? "Completing..." : "Complete task"}
        </button>
      ) : null}

      {assignedTo && !completed && packageDecision ? (
        <>
          <button
            type="button"
            disabled={busy || !packageId}
            onClick={() => postPackageDecision("approve")}
            className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
          >
            {busy ? "Working..." : "Approve package"}
          </button>

          <button
            type="button"
            disabled={busy || !packageId}
            onClick={() => postPackageDecision("request-more-info")}
            className="rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/20 disabled:opacity-50"
          >
            {busy ? "Working..." : "Request more information"}
          </button>
        </>
      ) : null}
    </div>
  );
}