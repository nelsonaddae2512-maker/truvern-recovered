"use client";

import React from "react";

type ScoreRow = { id: string; score: number; title?: string };
type BoardPayload = {
  org: string;
  overall: number;
  risk?: string;
  items: ScoreRow[];
  generatedAt?: string;
};

function useBoard(org?: string) {
  const [data, setData] = React.useState<BoardPayload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const orgId = org || qs.get("org") || "demo-2128873b";
    const url = `/api/reports/board?org=${encodeURIComponent(orgId)}`;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as BoardPayload;
        if (alive) setData(json);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Failed");
      }
    })();
    return () => { alive = false; };
  }, [org]);
  return { data, err };
}

export default function BoardKPISection({ org }: { org?: string }) {
  const { data, err } = useBoard(org);

  const overall = Math.round(data?.overall ?? 0);
  const items = data?.items ?? [];
  const hi = items.filter(x => (x.score ?? 0) >= 80).length;
  const mid = items.filter(x => (x.score ?? 0) >= 50 && (x.score ?? 0) < 80).length;
  const low = items.filter(x => (x.score ?? 0) < 50).length;

  return (
    <div className="mb-4 rounded-lg border border-zinc-200/70 bg-white/95 px-3 py-2 shadow-sm backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-900/80">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm">
        <div className="font-medium text-zinc-900 dark:text-zinc-100">KPI</div>
        {err ? (
          <div className="text-rose-600 dark:text-rose-400">Load error: {err}</div>
        ) : (
          <>
            <div className="text-zinc-700 dark:text-zinc-300">
              Overall: <span className="font-semibold">{overall}</span>
            </div>
            <div className="text-zinc-700 dark:text-zinc-300">
              High: <span className="font-semibold">{hi}</span>
            </div>
            <div className="text-zinc-700 dark:text-zinc-300">
              Medium: <span className="font-semibold">{mid}</span>
            </div>
            <div className="text-zinc-700 dark:text-zinc-300">
              Low: <span className="font-semibold">{low}</span>
            </div>
            <a
              href={`/reports/board?org=${encodeURIComponent(data?.org || "demo-2128873b")}`}
              className="ml-auto underline text-zinc-700 dark:text-zinc-300"
            >
              View board †’
            </a>
          </>
        )}
      </div>
    </div>
  );
}


