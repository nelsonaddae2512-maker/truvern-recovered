"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type ScoreComponent = {
  category: string;
  weight: number;
  deduction: number;
  score: number;
  findingCount: number;
};

type RootCause = {
  id: string;
  category: string;
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: number;
  findingCount: number;
  occurrenceCount: number;
  assets: string[];
  remediation: string;
  estimatedScoreGain: number;
};

type Violation = {
  ruleId: string;
  category: string;
  severity: Severity;
  confidence: number;
  title: string;
  description: string;
  asset: string | null;
  remediation: string;
  evidence: string[];
  occurrences: number;
};

type Result = {
  generatedAt: string;
  engineVersion: string;
  status: "HEALTHY" | "ATTENTION" | "REVIEW_REQUIRED" | "BLOCKED";
  score: number;
  enforceable: boolean;
  blockingReasons: string[];
  summary: {
    nodes: number;
    edges: number;
    cycles: number;
    rawOccurrences: number;
    uniqueFindings: number;
    actionableFindings: number;
    rootCauses: number;
    repositoryFiles: number;
    testFiles: number;
    documentationFiles: number;
    noiseReductionPercent: number;
  };
  severityCounts: Record<Severity, number>;
  categoryCounts: Record<string, number>;
  scoreComponents: ScoreComponent[];
  rootCauses: RootCause[];
  violations: Violation[];
  recommendations: Array<{
    title: string;
    ruleId: string;
    severity: Severity;
    affectedAssets: number;
    estimatedScoreGain: number;
    action: string;
  }>;
};

const severityRank: Record<Severity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function statusClass(status: Result["status"]) {
  if (status === "HEALTHY") return "border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100";
  if (status === "ATTENTION") return "border-amber-300/25 bg-amber-400/[0.08] text-amber-100";
  if (status === "REVIEW_REQUIRED") return "border-orange-300/25 bg-orange-400/[0.08] text-orange-100";
  return "border-rose-300/25 bg-rose-400/[0.08] text-rose-100";
}

function severityClass(severity: Severity) {
  if (severity === "CRITICAL") return "border-rose-300/20 bg-rose-400/[0.08] text-rose-100";
  if (severity === "HIGH") return "border-orange-300/20 bg-orange-400/[0.08] text-orange-100";
  if (severity === "MEDIUM") return "border-amber-300/20 bg-amber-400/[0.08] text-amber-100";
  if (severity === "LOW") return "border-cyan-300/20 bg-cyan-400/[0.08] text-cyan-100";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function AtlasRepositoryGovernance() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [selectedCause, setSelectedCause] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);

    try {
      const response = await fetch(
        "/api/truvern/atlas/repository-governance",
        { cache: "no-store" },
      );
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : `Repository Governance returned ${response.status}`,
        );
      }

      setResult(payload as Result);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "ATLAS Repository Governance failed.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRootCause = useMemo(
    () => result?.rootCauses.find((item) => item.id === selectedCause) ?? null,
    [result, selectedCause],
  );

  const sortedComponents = useMemo(
    () => [...(result?.scoreComponents ?? [])].sort((a, b) => b.weight - a.weight),
    [result],
  );

  return (
    <div>
      <header className="rounded-3xl border border-violet-400/15 bg-gradient-to-br from-violet-400/[0.09] via-slate-950 to-cyan-400/[0.05] p-6 shadow-2xl shadow-violet-950/20">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
          Truvern Operations Â· ATLAS-06B.1
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Governance Intelligence
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400 sm:text-base">
          A calibrated repository-health model that consolidates repeated findings,
          groups root causes, applies weighted scoring, and surfaces the few actions
          most likely to improve architecture and release readiness.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl bg-violet-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:opacity-50"
          >
            {loading ? "Evaluatingâ€¦" : "Refresh assessment"}
          </button>
        </div>
      </header>

      {failure ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-5 text-sm text-rose-100">
          <div className="font-semibold">Governance Intelligence unavailable</div>
          <p className="mt-1 text-rose-200/75">{failure}</p>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <section className={`rounded-2xl border p-5 ${statusClass(result.status)}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">Status</div>
              <div className="mt-2 text-2xl font-semibold">{result.status.replace("_", " ")}</div>
              <p className="mt-2 text-sm opacity-75">
                {result.enforceable ? "Release gate passes" : "Release gate blocks"}
              </p>
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Health score</div>
              <div className="mt-2 text-3xl font-semibold text-white">{result.score}<span className="text-base text-slate-500">/100</span></div>
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Root causes</div>
              <div className="mt-2 text-3xl font-semibold text-white">{result.summary.rootCauses}</div>
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Noise removed</div>
              <div className="mt-2 text-3xl font-semibold text-white">{result.summary.noiseReductionPercent}%</div>
            </section>
          </div>

          <section className="mt-5 rounded-3xl border border-white/10 bg-slate-950/75 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">Weighted repository health</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Each category has a fixed maximum contribution. Repeated findings saturate instead of driving the score to zero.
                </p>
              </div>
              <div className="text-xs text-slate-500">{result.engineVersion}</div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {sortedComponents.map((component) => (
                <article key={component.category} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {component.category.replace("_", " ")}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {component.score}<span className="text-sm text-slate-500">/{component.weight}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    âˆ’{component.deduction} points Â· {component.findingCount} findings
                  </p>
                </article>
              ))}
            </div>
          </section>

          {result.blockingReasons.length ? (
            <section className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/[0.07] p-5">
              <h2 className="font-semibold text-rose-100">Enforcement blockers</h2>
              <ul className="mt-3 space-y-2 text-sm text-rose-100/80">
                {result.blockingReasons.map((reason) => <li key={reason}>â€¢ {reason}</li>)}
              </ul>
            </section>
          ) : null}

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
              <div>
                <h2 className="font-semibold text-white">Priority root causes</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {result.summary.rawOccurrences} raw occurrences consolidated into {result.summary.uniqueFindings} unique findings.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {result.rootCauses.map((cause, index) => (
                  <button
                    key={cause.id}
                    type="button"
                    onClick={() => setSelectedCause(selectedCause === cause.id ? null : cause.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedCause === cause.id
                        ? "border-violet-300/30 bg-violet-400/[0.08]"
                        : "border-white/10 bg-white/[0.025] hover:bg-white/[0.045]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          #{index + 1} Â· {cause.ruleId}
                        </div>
                        <h3 className="mt-2 font-semibold text-white">{cause.title}</h3>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClass(cause.severity)}`}>
                        {cause.severity}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-950/60 p-2">
                        <div className="text-slate-500">Findings</div>
                        <div className="mt-1 font-semibold text-white">{cause.findingCount}</div>
                      </div>
                      <div className="rounded-xl bg-slate-950/60 p-2">
                        <div className="text-slate-500">Occurrences</div>
                        <div className="mt-1 font-semibold text-white">{cause.occurrenceCount}</div>
                      </div>
                      <div className="rounded-xl bg-slate-950/60 p-2">
                        <div className="text-slate-500">Potential gain</div>
                        <div className="mt-1 font-semibold text-emerald-200">+{cause.estimatedScoreGain}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.045] p-4">
                <h3 className="font-semibold text-white">
                  {selectedRootCause ? "Root-cause detail" : "Top improvement plan"}
                </h3>

                {selectedRootCause ? (
                  <div className="mt-3">
                    <p className="text-sm leading-6 text-slate-300">{selectedRootCause.remediation}</p>
                    <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Representative assets</div>
                    <div className="mt-2 space-y-2">
                      {selectedRootCause.assets.map((asset) => (
                        <code key={asset} className="block overflow-x-auto rounded-xl bg-slate-950/70 px-3 py-2 text-xs text-cyan-100">{asset}</code>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {result.recommendations.slice(0, 8).map((item, index) => (
                      <article key={`${item.ruleId}-${index}`} className="rounded-xl bg-slate-950/55 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-slate-500">#{index + 1} Â· {item.ruleId}</span>
                          <span className="text-xs font-semibold text-emerald-200">+{item.estimatedScoreGain}</span>
                        </div>
                        <h4 className="mt-2 text-sm font-semibold text-white">{item.title}</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{item.action}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <h3 className="font-semibold text-white">Signal quality</h3>
                <dl className="mt-3 space-y-3 text-sm">
                  {[
                    ["Raw occurrences", result.summary.rawOccurrences],
                    ["Unique findings", result.summary.uniqueFindings],
                    ["Actionable findings", result.summary.actionableFindings],
                    ["Root causes", result.summary.rootCauses],
                    ["Dependency cycles", result.summary.cycles],
                    ["Repository files", result.summary.repositoryFiles],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex justify-between gap-4">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-semibold text-slate-200">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <h3 className="font-semibold text-white">Severity</h3>
                <div className="mt-3 space-y-2">
                  {(Object.entries(result.severityCounts) as Array<[Severity, number]>)
                    .sort((a, b) => severityRank[b[0]] - severityRank[a[0]])
                    .map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between rounded-xl bg-slate-950/55 px-3 py-2 text-sm">
                        <span className="text-slate-400">{name}</span>
                        <span className="font-semibold text-white">{count}</span>
                      </div>
                    ))}
                </div>
              </section>
            </aside>
          </div>
        </>
      ) : loading ? (
        <section className="mt-5 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center text-sm text-slate-500">
          Calibrating repository governanceâ€¦
        </section>
      ) : null}
    </div>
  );
}

