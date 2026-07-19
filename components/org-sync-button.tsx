"use client";

import { useState } from "react";

export default function OrgSyncButton({ onDoneHref = "/vendors" }: { onDoneHref?: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/org/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setMsg(json?.error || "Sync failed");
      } else {
        window.location.href = onDoneHref;
      }
    } catch (e: any) {
      setMsg(e?.message || "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-sky-500/20 px-3 py-2 text-sm font-medium text-sky-200 hover:bg-sky-500/25 border border-sky-400/20 disabled:opacity-60"
      >
        {loading ? "Syncing…" : "Sync organization to DB"}
      </button>
      {msg && <div className="text-xs text-red-200/80">{msg}</div>}
    </div>
  );
}

