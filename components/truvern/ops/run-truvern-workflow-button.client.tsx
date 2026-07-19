"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RunTruvernWorkflowButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function runWorkflow() {
    try {
      setRunning(true);

      const response = await fetch("/api/review-desk/workflow-execution", {
        method: "POST",
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || `Workflow failed: ${(json?.failedStages || []).join(", ")}`);
      }

      alert(
        `Truvern Workflow Complete\n\nDuration: ${json.durationMs}ms\nFailed stages: ${(json.failedStages || []).length}\nStages: ${(json.stages || []).length}`,
      );

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Truvern workflow failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={runWorkflow}
      disabled={running}
      className="rounded-2xl border border-lime-300/25 bg-lime-400/10 px-4 py-2 text-sm font-semibold text-lime-100 hover:bg-lime-400/20 disabled:opacity-50"
    >
      {running ? "Running Truvern Workflow..." : "Run Truvern Workflow"}
    </button>
  );
}
