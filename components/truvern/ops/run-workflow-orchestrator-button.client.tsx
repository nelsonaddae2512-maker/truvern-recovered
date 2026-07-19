"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RunWorkflowOrchestratorButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function runOrchestrator() {
    try {
      setRunning(true);

      const response = await fetch("/api/review-desk/workflow-orchestrator", {
        method: "POST",
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Orchestrator failed.");
      }

      alert(
        `Orchestrator complete.\n\nChecked: ${json.orchestrator?.checked ?? 0}\nReady for release: ${json.orchestrator?.readyForRelease ?? 0}\nEscalated: ${json.orchestrator?.escalated ?? 0}\nUnclaimed: ${json.scheduler?.unclaimed ?? 0}`,
      );

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Orchestrator failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={runOrchestrator}
      disabled={running}
      className="rounded-2xl border border-violet-300/25 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-400/20 disabled:opacity-50"
    >
      {running ? "Running orchestrator..." : "Run orchestrator"}
    </button>
  );
}
