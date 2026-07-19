"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RunReleaseReadinessButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function runReadiness() {
    try {
      setRunning(true);

      const response = await fetch("/api/review-desk/release-readiness", {
        method: "POST",
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Release readiness failed.");
      }

      alert(
        `Release Readiness Complete\n\nChecked: ${json.checked}\nReady: ${json.ready}\nBlocked: ${json.blocked}`,
      );

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Release readiness failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={runReadiness}
      disabled={running}
      className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
    >
      {running ? "Checking readiness..." : "Run release readiness"}
    </button>
  );
}
