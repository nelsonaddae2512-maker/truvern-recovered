"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RunWorkflowSchedulerButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function runScheduler() {
    try {
      setRunning(true);

      const response = await fetch("/api/review-desk/workflow-scheduler", {
        method: "POST",
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Scheduler failed.");
      }

      alert(
        `Scheduler complete.\n\nChecked: ${json.checked}\nOverdue: ${json.overdue}\nDue soon: ${json.dueSoon}\nUnclaimed: ${json.unclaimed}`,
      );

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Scheduler failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={runScheduler}
      disabled={running}
      className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
    >
      {running ? "Running scheduler..." : "Run scheduler"}
    </button>
  );
}
