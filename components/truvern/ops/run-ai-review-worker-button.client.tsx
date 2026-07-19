"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RunAiReviewWorkerButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function runWorker() {
    try {
      setRunning(true);

      const response = await fetch("/api/review-desk/ai-review-worker", {
        method: "POST",
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "AI Worker failed.");
      }

      alert(`AI Review Worker Complete\n\nChecked: ${json.checked}\nCompleted: ${json.completed}`);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "AI Worker failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={runWorker}
      disabled={running}
      className="rounded-2xl border border-indigo-400/30 bg-indigo-500/15 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/25 disabled:opacity-50"
    >
      {running ? "Running AI Worker..." : "Run AI Review"}
    </button>
  );
}
