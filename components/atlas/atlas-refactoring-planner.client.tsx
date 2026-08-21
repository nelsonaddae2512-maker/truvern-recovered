"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Plan = {
  id: string;
  priority: number;
  title: string;
  ruleId: string;
  category: string;
  severity: string;
  ownershipArea: string;
  recommendedOwner: string;
  centralAsset: string | null;
  affectedFiles: string[];
  affectedFileCount: number;
  affectedEdgeCount: number;
  affectedOccurrences: number;
  regressionRisk: {
    level: "LOW" | "MEDIUM" | "HIGH";
    score: number;
    maxImpact: number;
  };
  effort: {
    minutes: number;
    hours: number;
    label: string;
  };
  tests: {
    files: string[];
    commands: string[];
    missingFocusedCoverage: boolean;
  };
  steps: Array<{
    order: number;
    title: string;
    description: string;
    validation: string;
  }>;
  rollback: string[];
  estimatedScoreGain: number;
  projectedRepositoryScore: number;
  releaseImpact: string;
};

type Result = {
  generatedAt: string;
  engineVersion: "ATLAS-07";
  repositoryScore: number;
  repositoryStatus: string;
  summary: {
    rootCausesAvailable: number;
    plansGenerated: number;
    totalAffectedFiles: number;
    totalEstimatedHours: number;
    potentialScoreGain: number;
    projectedMaximumScore: number;
    highRiskPlans: number;
    mediumRiskPlans: number;
    lowRiskPlans: number;
  };
  plans: Plan[];
};

function riskClass(level: Plan["regressionRisk"]["level"]) {
  if (level === "HIGH") return "border-rose-300/20 bg-rose-400/[0.08] text-rose-100";
  if (level === "MEDIUM") return "border-amber-300/20 bg-amber-400/[0.08] text-amber-100";
  return "border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function AtlasRefactoringPlanner() {
  const [result, setResult] = useState<Result | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);

    try {
      const response = await fetch("/api/truvern/atlas/refactoring-planner", {
        cache: "no-store",
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : `Refactoring Planner returned ${response.status}`,
        );
      }

      const next = payload as Result;
      setResult(next);
      setSelectedId((current) => current ?? next.plans[0]?.id ?? null);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "ATLAS Refactoring Planner failed.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => result?.plans.find((plan) => plan.id === selectedId) ?? null,
    [result, selectedId],
  );

  return (
    <div>
      <header className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.08] via-slate-950 to-violet-400/[0.06] p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Truvern Operations Â· ATLAS-07
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Intelligent Refactoring Planner
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400 sm:text-base">
          Converts governance root causes into ordered engineering plans with affected
          files, dependency scope, effort, regression risk, test impact, release
          guidance, and rollback strategy.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
          >
            {loading ? "Planningâ€¦" : "Regenerate plans"}
          </button>
        </div>
      </header>

      {failure ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-5 text-sm text-rose-100">
          <div className="font-semibold">Refactoring Planner unavailable</div>
          <p className="mt-1 text-rose-200/75">{failure}</p>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-5">
            {[
              ["Current score", `${result.repositoryScore}/100`],
              ["Plans", result.summary.plansGenerated],
              ["Affected files", result.summary.totalAffectedFiles],
              ["Estimated effort", `${result.summary.totalEstimatedHours}h`],
              ["Projected score", `${result.summary.projectedMaximumScore}/100`],
            ].map(([label, value]) => (
              <section key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
              </section>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
            <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-4">
              <div className="px-1">
                <h2 className="font-semibold text-white">Execution order</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Plans are ranked by architectural impact and governance priority.
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {result.plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedId(plan.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedId === plan.id
                        ? "border-cyan-300/30 bg-cyan-400/[0.08]"
                        : "border-white/10 bg-white/[0.025] hover:bg-white/[0.045]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {plan.id} Â· Priority {plan.priority}
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-white">{plan.title}</h3>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${riskClass(plan.regressionRisk.level)}`}>
                        {plan.regressionRisk.level}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-950/60 p-2">
                        <div className="text-slate-500">Files</div>
                        <div className="mt-1 font-semibold text-white">{plan.affectedFileCount}</div>
                      </div>
                      <div className="rounded-xl bg-slate-950/60 p-2">
                        <div className="text-slate-500">Effort</div>
                        <div className="mt-1 font-semibold text-white">{plan.effort.hours}h</div>
                      </div>
                      <div className="rounded-xl bg-slate-950/60 p-2">
                        <div className="text-slate-500">Gain</div>
                        <div className="mt-1 font-semibold text-emerald-200">+{plan.estimatedScoreGain}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {selected ? (
              <section className="space-y-5">
                <article className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                        {selected.id} Â· {selected.ruleId}
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-white">{selected.title}</h2>
                      <p className="mt-2 text-sm text-slate-400">
                        Owner: {selected.recommendedOwner} Â· Area: {selected.ownershipArea}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${riskClass(selected.regressionRisk.level)}`}>
                      {selected.regressionRisk.level} regression risk
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Affected files", selected.affectedFileCount],
                      ["Dependency edges", selected.affectedEdgeCount],
                      ["Estimated effort", `${selected.effort.hours}h`],
                      ["Projected score", `${selected.projectedRepositoryScore}/100`],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                        <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</div>
                        <div className="mt-2 text-xl font-semibold text-white">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-400/[0.05] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-300">Release impact</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{selected.releaseImpact}</p>
                  </div>
                </article>

                <article className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                  <h3 className="font-semibold text-white">Implementation sequence</h3>
                  <div className="mt-4 space-y-3">
                    {selected.steps.map((step) => (
                      <div key={step.order} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                        <div className="flex gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-sm font-semibold text-slate-950">
                            {step.order}
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">{step.title}</h4>
                            <p className="mt-1 text-sm leading-6 text-slate-400">{step.description}</p>
                            <p className="mt-2 text-xs text-emerald-200/80">Validation: {step.validation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <div className="grid gap-5 lg:grid-cols-2">
                  <article className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                    <h3 className="font-semibold text-white">Affected files</h3>
                    <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                      {selected.affectedFiles.map((file) => (
                        <code key={file} className="block overflow-x-auto rounded-xl bg-white/[0.035] px-3 py-2 text-xs text-cyan-100">
                          {file}
                        </code>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                    <h3 className="font-semibold text-white">Rollback strategy</h3>
                    <ol className="mt-3 space-y-3">
                      {selected.rollback.map((item, index) => (
                        <li key={item} className="flex gap-3 text-sm leading-6 text-slate-400">
                          <span className="font-semibold text-rose-200">{index + 1}.</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  </article>
                </div>
              </section>
            ) : null}
          </div>
        </>
      ) : loading ? (
        <section className="mt-5 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center text-sm text-slate-500">
          Building refactoring plansâ€¦
        </section>
      ) : null}
    </div>
  );
}

