"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Data = {
  generatedAt: string;
  summary: {
    filesAnalyzed: number;
    apiRoutes: number;
    pages: number;
    components: number;
    prismaModels: number;
    semanticFeatures: number;
    highPriorityTestTargets: number;
    journeys: number;
  };
  features: Array<{
    name: string;
    fileCount: number;
    routeCount: number;
    totalTestPriority: number;
  }>;
  journeys: Array<{
    name: string;
    completeness: number;
    steps: Array<{
      order: number;
      feature: string;
      representativeFiles: string[];
    }>;
  }>;
  highPriorityTests: Array<{
    rank: number;
    file: string;
    semanticArea: string;
    score: number;
    reasons: string[];
    suggestedTestType: string;
    suggestedTestPath: string;
  }>;
};

export default function AtlasSemanticIntelligence() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feature, setFeature] = useState<string>("all");

  const load = useCallback(async (refresh = false) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/truvern/atlas/semantic-intelligence", {
        method: refresh ? "POST" : "GET",
        cache: "no-store",
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || `Request failed: ${response.status}`);
      setData(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Semantic intelligence failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  const tests = useMemo(() => {
    if (!data) return [];
    if (feature === "all") return data.highPriorityTests;
    return data.highPriorityTests.filter((item) => item.semanticArea.startsWith(feature + "/"));
  }, [data, feature]);

  return (
    <div>
      <header className="rounded-3xl border border-cyan-400/15 bg-slate-950 p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Truvern Operations Â· ATLAS-10
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          Semantic Repository Intelligence
        </h1>
        <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-400">
          Maps routes, components, data access, workflow states, business capabilities,
          user journeys, and high-value test targets from the live repository.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void load(true)}
            className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {busy ? "Analyzingâ€¦" : "Refresh semantic map"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-5 text-rose-100">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-4 xl:grid-cols-8">
            {[
              ["Files", data.summary.filesAnalyzed],
              ["API routes", data.summary.apiRoutes],
              ["Pages", data.summary.pages],
              ["Components", data.summary.components],
              ["Prisma models", data.summary.prismaModels],
              ["Features", data.summary.semanticFeatures],
              ["Test targets", data.summary.highPriorityTestTargets],
              ["Journeys", data.summary.journeys],
            ].map(([label, value]) => (
              <section key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
              </section>
            ))}
          </div>

          <section className="mt-5 rounded-3xl border border-white/10 bg-slate-950/75 p-5">
            <h2 className="font-semibold text-white">Business capability map</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.features.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setFeature(item.name)}
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left"
                >
                  <div className="font-semibold text-white">{item.name}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {item.fileCount} files Â· {item.routeCount} routes Â· priority {item.totalTestPriority}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5 rounded-3xl border border-white/10 bg-slate-950/75 p-5">
            <h2 className="font-semibold text-white">Inferred business journeys</h2>
            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              {data.journeys.map((journey) => (
                <article key={journey.name} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-white">{journey.name}</h3>
                    <span className="text-xs text-cyan-300">
                      {Math.round(journey.completeness * 100)}%
                    </span>
                  </div>
                  <ol className="mt-4 space-y-3">
                    {journey.steps.map((step) => (
                      <li key={`${journey.name}-${step.feature}`} className="text-sm">
                        <div className="font-medium text-slate-200">
                          {step.order}. {step.feature}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {step.representativeFiles[0] || "No representative file identified"}
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-5 rounded-3xl border border-white/10 bg-slate-950/75 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-white">High-value test targets</h2>
              <select
                value={feature}
                onChange={(event) => setFeature(event.target.value)}
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white"
              >
                <option value="all">All semantic areas</option>
                {data.features.map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Rank</th>
                    <th className="px-3 py-3">Repository file</th>
                    <th className="px-3 py-3">Semantic area</th>
                    <th className="px-3 py-3">Priority</th>
                    <th className="px-3 py-3">Test type</th>
                    <th className="px-3 py-3">Suggested test path</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((item) => (
                    <tr key={item.file} className="border-t border-white/5 text-slate-300">
                      <td className="px-3 py-3">{item.rank}</td>
                      <td className="px-3 py-3 font-medium text-white">{item.file}</td>
                      <td className="px-3 py-3">{item.semanticArea}</td>
                      <td className="px-3 py-3">{item.score}</td>
                      <td className="px-3 py-3">{item.suggestedTestType}</td>
                      <td className="px-3 py-3 font-mono text-xs text-cyan-200">{item.suggestedTestPath}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

