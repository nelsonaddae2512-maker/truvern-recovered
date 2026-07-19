"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  assessmentId: number;
  variant?: "compact" | "panel";
};

export default function AssessmentPortalControls({
  assessmentId,
  variant = "compact",
}: Props) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: "revoke" | "cancel" | "regenerate") {
    const message =
      action === "revoke"
        ? "Revoke this vendor portal link?\n\nThe current vendor token will be invalidated and the existing link will stop working."
        : action === "cancel"
          ? "Cancel this assessment workflow?\n\nThis archives the assessment and invalidates the current vendor portal token."
          : "Regenerate this vendor portal token?\n\nThe old vendor link will stop working and a new secure token will be issued.";

    const confirmed = window.confirm(message);

    if (!confirmed) return;

    setBusyAction(action);
    setError(null);

    try {
      const res = await fetch(`/api/assessments/${assessmentId}/portal-controls`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Portal lifecycle update failed.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal lifecycle update failed.");
    } finally {
      setBusyAction(null);
    }
  }

  const buttonBase =
    variant === "panel"
      ? "rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-60"
      : "rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60";

  return (
    <div className={variant === "panel" ? "mt-6 space-y-4" : "space-y-3"}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => runAction("revoke")}
          className={`${buttonBase} border border-amber-300/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15`}
        >
          {busyAction === "revoke" ? "Revoking..." : "Revoke portal"}
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => runAction("regenerate")}
          className={`${buttonBase} border border-cyan-300/20 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/15`}
        >
          {busyAction === "regenerate" ? "Regenerating..." : "Regenerate token"}
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => runAction("cancel")}
          className={`${buttonBase} border border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15`}
        >
          {busyAction === "cancel" ? "Cancelling..." : "Cancel assessment"}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
    </div>
  );
}
