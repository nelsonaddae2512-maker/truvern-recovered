"use client";
import { useCallback, useEffect, useState } from "react";

type Result = {
  repositoryScore: number;
  summary: {
    originalEstimatedHours: number;
    overlapSavingsHours: number;
    coordinationOverheadHours: number;
    optimizedEstimatedHours: number;
    savingsPercent: number;
    phases: number;
    projectedMaximumScore: number;
  };
  safestFirstPlan: { id: string; title: string; risk: string; effortHours: number; estimatedScoreGain: number } | null;
  phases: Array<{
    phase: number;
    label: string;
    planIds: string[];
    planCount: number;
    affectedFileCount: number;
    estimatedHoursBeforeOverlap: number;
    potentialScoreGain: number;
    riskCounts: { HIGH: number; MEDIUM: number; LOW: number };
  }>;
};

export default function AtlasPortfolioOptimizer() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/truvern/atlas/portfolio-optimizer", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Portfolio optimizer failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <header className="rounded-3xl border border-violet-400/15 bg-slate-950 p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">Truvern Operations Â· ATLAS-07A</div>
        <h1 className="mt-3 text-3xl font-semibold text-white">Refactoring Portfolio Optimizer</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
          Removes overlapping engineering effort, orders prerequisites, creates phased releases, and recommends the safest first plan.
        </p>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="mt-5 rounded-xl bg-violet-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">
          {loading ? "Optimizingâ€¦" : "Regenerate portfolio"}
        </button>
      </header>

      {error ? <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-5 text-rose-100">{error}</div> : null}

      {result ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["Original", `${result.summary.originalEstimatedHours}h`],
              ["Overlap removed", `${result.summary.overlapSavingsHours}h`],
              ["Optimized", `${result.summary.optimizedEstimatedHours}h`],
              ["Savings", `${result.summary.savingsPercent}%`],
              ["Phases", result.summary.phases],
              ["Projected score", `${result.summary.projectedMaximumScore}/100`],
            ].map(([label, value]) => (
              <section key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
              </section>
            ))}
          </div>

          {result.safestFirstPlan ? (
            <section className="mt-5 rounded-3xl border border-emerald-300/15 bg-emerald-400/[0.05] p-5">
              <div className="text-xs uppercase tracking-[0.16em] text-emerald-300">Safest first plan</div>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {result.safestFirstPlan.id} Â· {result.safestFirstPlan.title}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {result.safestFirstPlan.risk} risk Â· {result.safestFirstPlan.effortHours}h Â· +{result.safestFirstPlan.estimatedScoreGain} score gain
              </p>
            </section>
          ) : null}

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {result.phases.map((phase) => (
              <article key={phase.phase} className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-violet-300">Phase {phase.phase}</div>
                <h2 className="mt-2 text-xl font-semibold text-white">{phase.label}</h2>
                <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
                  <div><div className="text-slate-500">Plans</div><div className="mt-1 font-semibold text-white">{phase.planCount}</div></div>
                  <div><div className="text-slate-500">Files</div><div className="mt-1 font-semibold text-white">{phase.affectedFileCount}</div></div>
                  <div><div className="text-slate-500">Effort</div><div className="mt-1 font-semibold text-white">{phase.estimatedHoursBeforeOverlap}h</div></div>
                  <div><div className="text-slate-500">Gain</div><div className="mt-1 font-semibold text-emerald-200">+{phase.potentialScoreGain}</div></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {phase.planIds.map((id) => (
                    <span key={id} className="rounded-xl border border-cyan-300/15 bg-cyan-400/[0.05] px-3 py-2 text-xs font-semibold text-cyan-100">{id}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

