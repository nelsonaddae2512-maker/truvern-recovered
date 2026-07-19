"use client";

import { useState } from "react";

type Result = {
  ok?: boolean;
  totals?: {
    fetched?: number;
    sentOrWouldSend?: number;
    skippedClosed?: number;
    skippedThrottled?: number;
    skippedNoEmail?: number;
    errors?: number;
  };
  error?: string;
};

export default function RemindDueSoonButton({ days = 7 }: { days?: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/evidence-requests/remind-due-soon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, days, limit: 200 }),
      });
      const json = (await res.json()) as Result;
      setResult(json);
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  const totals = result?.totals || {};

  return (
    <div className="flex items-center gap-3">
      <button className="btn-glass" onClick={run} disabled={loading}>
        {loading ? "Sending..." : `Remind due soon (${days}d)`}
      </button>

      {result ? (
        <div className="text-xs text-muted-foreground">
          {result.ok ? (
            <>
              <span className="text-emerald-200">
                {totals.sentOrWouldSend ?? 0} sent
              </span>
              {" · "}
              <span>{totals.skippedNoEmail ?? 0} missing email</span>
              {" · "}
              <span>{totals.skippedThrottled ?? 0} throttled</span>
              {" · "}
              <span>{totals.skippedClosed ?? 0} closed</span>
            </>
          ) : (
            <span className="text-amber-200">{result.error || "Error"}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}


