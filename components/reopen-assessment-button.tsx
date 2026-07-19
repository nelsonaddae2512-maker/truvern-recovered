// components/reopen-assessment-button.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReopenAssessmentButton({
  assessmentId,
}: {
  assessmentId: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reopen() {
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/assessment-runs/${assessmentId}/reopen`, {
        method: "POST",
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);

      // go back to the editor, refreshed
      router.push(`/assessment/runs/${assessmentId}`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Reopen failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={reopen}
        disabled={loading}
        className="rounded-full border border-amber-400/50 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/15 disabled:opacity-60"
      >
        {loading ? "Reopening€¦" : "Reopen"}
      </button>
      {err ? <div className="text-xs text-rose-200">{err}</div> : null}
    </div>
  );
}


