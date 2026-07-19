"use client";

import { useState } from "react";

type Props = {
  issueId: number;
  currentStatus: string;
};

export default function IssueActions({ issueId, currentStatus }: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setIssueStatus(next: string) {
    setLoading(next);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update status");

      setStatus(json.issue?.status || next);
      // quick refresh so server-rendered page reflects changes/events
      window.location.reload();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(null);
    }
  }

  const btn =
    "rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 hover:ring-white/20 disabled:opacity-50";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="text-xs text-slate-400">Status: {status}</div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          className={btn}
          disabled={loading !== null}
          onClick={() => setIssueStatus("IN_REVIEW")}
        >
          {loading === "IN_REVIEW" ? "Updating€¦" : "Mark In Review"}
        </button>

        <button
          className={btn}
          disabled={loading !== null}
          onClick={() => setIssueStatus("RESOLVED")}
        >
          {loading === "RESOLVED" ? "Updating€¦" : "Resolve"}
        </button>

        <button
          className={btn}
          disabled={loading !== null}
          onClick={() => setIssueStatus("ACCEPTED_RISK")}
        >
          {loading === "ACCEPTED_RISK" ? "Updating€¦" : "Accept Risk"}
        </button>

        <button
          className={btn}
          disabled={loading !== null}
          onClick={() => setIssueStatus("OPEN")}
        >
          {loading === "OPEN" ? "Updating€¦" : "Reopen"}
        </button>
      </div>

      {error ? (
        <div className="mt-1 text-xs text-rose-300">{error}</div>
      ) : null}
    </div>
  );
}


