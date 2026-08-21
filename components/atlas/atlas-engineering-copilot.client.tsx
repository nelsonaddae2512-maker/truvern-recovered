"use client";

import { useMemo, useState, type FormEvent } from "react";

type Mode = "PLAN" | "REGRESSION" | "DEBT";

type Asset = {
  id: string;
  label: string;
  type: string;
  layer: string;
  file: string;
  features: string[];
  impactScore: number;
  matchScore?: number;
};

type Plan = {
  mode: "PLAN" | "REGRESSION";
  request: string;
  generatedAt: string;
  complexity: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  summary: string;
  targets: Asset[];
  related: Asset[];
  affectedFeatures: string[];
  sequence: Array<{
    step: number;
    layer: string;
    objective: string;
    assets: Asset[];
  }>;
  risks: string[];
  validation: string[];
  reviewerChecklist: string[];
  regressionAreas?: Array<{
    area: string;
    reason: string;
  }>;
};

type Debt = {
  mode: "DEBT";
  generatedAt: string;
  summary: string;
  cycles: string[][];
  hotspots: Asset[];
  recommendations: string[];
};

type Result = Plan | Debt;

const EXAMPLES = [
  "Add a submitted questionnaire queue to Truvern Ops reviews",
  "Restore the self-managed and hybrid review paths",
  "Fix vendor portal links and reusable vendor progress",
  "Add analyst assignment and approval rail to customer reviews",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function complexityClass(value: Plan["complexity"]) {
  if (value === "LOW") {
    return "border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100";
  }
  if (value === "MEDIUM") {
    return "border-amber-300/20 bg-amber-400/[0.08] text-amber-100";
  }
  return "border-rose-300/20 bg-rose-400/[0.08] text-rose-100";
}

function AssetList({
  title,
  assets,
}: {
  title: string;
  assets: Asset[];
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-white">{title}</h3>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">
          {assets.length}
        </span>
      </div>

      {assets.length ? (
        <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {assets.map((asset) => (
            <article
              key={asset.id}
              className="rounded-xl border border-white/5 bg-slate-950/55 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-100">
                    {asset.label}
                  </div>
                  <div className="mt-1 break-all text-xs text-slate-500">
                    {asset.file}
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-amber-400/[0.08] px-2 py-1 text-xs font-semibold text-amber-200">
                  {asset.impactScore}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.07] px-2 py-1 text-[11px] text-cyan-200">
                  {asset.layer}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[11px] text-slate-400">
                  {asset.type}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No strong architecture match was found.
        </p>
      )}
    </section>
  );
}

export default function AtlasEngineeringCopilot() {
  const [mode, setMode] = useState<Mode>("PLAN");
  const [request, setRequest] = useState(EXAMPLES[0]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const plan = result?.mode === "DEBT" ? null : result;
  const debt = result?.mode === "DEBT" ? result : null;

  const confidence = useMemo(() => {
    if (!plan) return "â€”";
    return `${Math.round(plan.confidence * 100)}%`;
  }, [plan]);

  async function run(event?: FormEvent) {
    event?.preventDefault();

    if (mode !== "DEBT" && !request.trim()) return;

    setLoading(true);
    setFailure(null);

    try {
      const response = await fetch("/api/truvern/atlas/engineering-copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          request: mode === "DEBT" ? undefined : request.trim(),
        }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : `Engineering Copilot returned ${response.status}`,
        );
      }

      if (!isRecord(payload) || typeof payload.mode !== "string") {
        throw new Error("ATLAS returned an invalid copilot payload.");
      }

      setResult(payload as Result);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "ATLAS Engineering Copilot failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <header className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.09] via-slate-950 to-indigo-400/[0.06] p-6 shadow-2xl shadow-cyan-950/20">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Truvern Operations Â· ATLAS-05A
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Engineering Copilot
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400 sm:text-base">
          Turn a product request into a graph-grounded implementation plan.
          ATLAS identifies likely files, dependency order, regression exposure,
          architecture risks, and required validation before a patch begins.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {(["PLAN", "REGRESSION", "DEBT"] as Mode[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                mode === option
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.07]"
              }`}
            >
              {option === "PLAN"
                ? "Implementation plan"
                : option === "REGRESSION"
                  ? "Regression analysis"
                  : "Technical debt"}
            </button>
          ))}
        </div>

        <form onSubmit={run} className="mt-5">
          {mode !== "DEBT" ? (
            <>
              <textarea
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                rows={3}
                className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
                placeholder="Describe the feature, patch, or architecture changeâ€¦"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setRequest(example)}
                    className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-400 transition hover:border-cyan-300/20 hover:text-cyan-100"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-slate-400">
              Technical Debt mode analyzes the full ATLAS graph, including
              dependency cycles and the highest-impact architecture hotspots.
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={
                loading || (mode !== "DEBT" && !request.trim())
              }
              className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Analyzing architectureâ€¦"
                : mode === "DEBT"
                  ? "Analyze technical debt"
                  : mode === "REGRESSION"
                    ? "Analyze regression exposure"
                    : "Build implementation plan"}
            </button>
          </div>
        </form>
      </header>

      {failure ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-5 text-sm text-rose-100">
          <div className="font-semibold">Engineering Copilot unavailable</div>
          <p className="mt-1 text-rose-200/75">{failure}</p>
        </div>
      ) : null}

      {plan ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <section
              className={`rounded-2xl border p-5 ${complexityClass(plan.complexity)}`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                Complexity
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {plan.complexity}
              </div>
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Confidence
              </div>
              <div className="mt-2 text-3xl font-semibold text-white">
                {confidence}
              </div>
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Affected features
              </div>
              <div className="mt-2 text-3xl font-semibold text-white">
                {plan.affectedFeatures.length}
              </div>
            </section>
          </div>

          <section className="mt-5 rounded-3xl border border-white/10 bg-slate-950/75 p-5">
            <h2 className="font-semibold text-white">Copilot assessment</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {plan.summary}
            </p>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="space-y-5">
              <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                <h2 className="font-semibold text-white">
                  Recommended implementation sequence
                </h2>
                <div className="mt-4 space-y-4">
                  {plan.sequence.map((step) => (
                    <article
                      key={`${step.step}-${step.layer}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-sm font-semibold text-cyan-200">
                          {step.step}
                        </span>
                        <div>
                          <h3 className="font-semibold text-white">
                            {step.layer}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-slate-400">
                            {step.objective}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {step.assets.map((asset) => (
                          <span
                            key={asset.id}
                            className="rounded-full border border-white/10 bg-slate-950/60 px-2.5 py-1 text-xs text-slate-300"
                          >
                            {asset.label}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <AssetList
                  title="Likely implementation assets"
                  assets={plan.targets}
                />
                <AssetList
                  title="Related dependency exposure"
                  assets={plan.related}
                />
              </div>

              {plan.regressionAreas?.length ? (
                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <h3 className="font-semibold text-white">
                    Regression areas
                  </h3>
                  <div className="mt-3 space-y-2">
                    {plan.regressionAreas.map((item) => (
                      <div
                        key={`${item.area}-${item.reason}`}
                        className="rounded-xl bg-slate-950/55 px-3 py-3"
                      >
                        <div className="text-sm font-medium text-slate-100">
                          {item.area}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          {item.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.045] p-4">
                <h3 className="font-semibold text-white">
                  Architecture risks
                </h3>
                <ul className="mt-3 space-y-3">
                  {plan.risks.map((risk) => (
                    <li
                      key={risk}
                      className="rounded-xl bg-slate-950/50 px-3 py-3 text-sm leading-6 text-slate-300"
                    >
                      {risk}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.045] p-4">
                <h3 className="font-semibold text-white">
                  Validation commands
                </h3>
                <div className="mt-3 space-y-2">
                  {plan.validation.map((item) => (
                    <code
                      key={item}
                      className="block overflow-x-auto rounded-xl bg-slate-950/70 px-3 py-2 text-xs text-cyan-100"
                    >
                      {item}
                    </code>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <h3 className="font-semibold text-white">
                  Reviewer checklist
                </h3>
                <div className="mt-3 space-y-3">
                  {plan.reviewerChecklist.map((item) => (
                    <label
                      key={item}
                      className="flex gap-3 rounded-xl bg-slate-950/50 px-3 py-3 text-sm leading-6 text-slate-300"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <h3 className="font-semibold text-white">
                  Affected features
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {plan.affectedFeatures.length ? (
                    plan.affectedFeatures.map((feature) => (
                      <span
                        key={feature}
                        className="rounded-full border border-indigo-300/15 bg-indigo-400/[0.08] px-2.5 py-1 text-xs text-indigo-200"
                      >
                        {feature}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">
                      None detected.
                    </span>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </>
      ) : null}

      {debt ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
              <h2 className="font-semibold text-white">
                Technical-debt assessment
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {debt.summary}
              </p>
            </section>

            <AssetList
              title="Highest-impact architecture hotspots"
              assets={debt.hotspots}
            />

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-white">
                  Dependency cycles
                </h3>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">
                  {debt.cycles.length}
                </span>
              </div>
              <div className="mt-3 max-h-[600px] space-y-2 overflow-y-auto pr-1">
                {debt.cycles.map((cycle, index) => (
                  <div
                    key={`${index}-${cycle.join("-")}`}
                    className="rounded-xl border border-rose-300/10 bg-rose-400/[0.04] px-3 py-3 text-xs leading-5 text-rose-100/80"
                  >
                    {cycle.join(" â†’ ")}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside>
            <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.045] p-4">
              <h3 className="font-semibold text-white">
                Refactoring priorities
              </h3>
              <ol className="mt-3 space-y-3">
                {debt.recommendations.map((item, index) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm leading-6 text-slate-300"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-xs font-semibold text-cyan-200">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

