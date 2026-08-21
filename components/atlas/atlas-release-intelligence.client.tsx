"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Snapshot = {
  file: string;
  name: string;
  createdAt: string;
  graphHash: string;
  summary: {
    nodes: number;
    edges: number;
    cycles: number;
    featureCoupling: number;
  };
};

type ReleaseNode = {
  id: string;
  label: string;
  type: string;
  features?: string[];
  impact?: {
    score?: number;
  } | null;
};

type ReleaseDiff = {
  generatedAt: string;
  baseline: {
    name: string;
    createdAt: string;
    graphHash: string;
    summary: Snapshot["summary"];
  };
  current: {
    graphHash: string;
    summary: Snapshot["summary"];
  };
  readiness: "READY" | "CAUTION" | "REVIEW_REQUIRED" | "BLOCKED";
  riskScore: number;
  summary: {
    addedNodes: number;
    removedNodes: number;
    changedNodes: number;
    addedEdges: number;
    removedEdges: number;
    newCycles: number;
    resolvedCycles: number;
    affectedFeatures: number;
    highImpactChanges: number;
  };
  addedNodes: ReleaseNode[];
  removedNodes: ReleaseNode[];
  changedNodes: Array<{
    id: string;
    before: ReleaseNode;
    after: ReleaseNode;
    impactDelta: number;
  }>;
  newCycles: string[][];
  resolvedCycles: string[][];
  affectedFeatures: string[];
  highImpactChanges: ReleaseNode[];
  checklist: string[];
};

type ApiPayload = {
  snapshots: Snapshot[];
  diff: ReleaseDiff;
};

const metricLabels: Array<
  [keyof ReleaseDiff["summary"], string]
> = [
  ["addedNodes", "Added nodes"],
  ["removedNodes", "Removed nodes"],
  ["changedNodes", "Changed nodes"],
  ["addedEdges", "Added edges"],
  ["removedEdges", "Removed edges"],
  ["newCycles", "New cycles"],
  ["resolvedCycles", "Resolved cycles"],
  ["affectedFeatures", "Affected features"],
  ["highImpactChanges", "High-impact changes"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readinessClass(readiness: ReleaseDiff["readiness"]) {
  if (readiness === "READY") {
    return "border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100";
  }
  if (readiness === "CAUTION") {
    return "border-amber-300/25 bg-amber-400/[0.08] text-amber-100";
  }
  if (readiness === "REVIEW_REQUIRED") {
    return "border-orange-300/25 bg-orange-400/[0.08] text-orange-100";
  }
  return "border-rose-300/25 bg-rose-400/[0.08] text-rose-100";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function NodeList({
  title,
  nodes,
}: {
  title: string;
  nodes: ReleaseNode[];
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-white">{title}</h3>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">
          {nodes.length}
        </span>
      </div>

      {nodes.length ? (
        <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="rounded-xl border border-white/5 bg-slate-950/55 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-100">
                    {node.label}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {node.type} Â· {node.id}
                  </div>
                </div>
                <div className="shrink-0 text-xs font-semibold text-amber-200">
                  {node.impact?.score ?? 0}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">None detected.</p>
      )}
    </section>
  );
}

export default function AtlasReleaseIntelligence() {
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async (selectedBaseline?: string) => {
    setLoading(true);
    setFailure(null);

    try {
      const query = selectedBaseline
        ? `?baseline=${encodeURIComponent(selectedBaseline)}`
        : "";
      const response = await fetch(
        `/api/truvern/atlas/release-intelligence${query}`,
        { cache: "no-store" },
      );
      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isRecord(data) && typeof data.error === "string"
            ? data.error
            : `Release Intelligence returned ${response.status}`,
        );
      }

      if (
        !isRecord(data) ||
        !Array.isArray(data.snapshots) ||
        !isRecord(data.diff)
      ) {
        throw new Error("ATLAS returned an invalid release payload.");
      }

      setPayload(data as ApiPayload);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "ATLAS Release Intelligence failed.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const diff = payload?.diff;

  const changeTotal = useMemo(() => {
    if (!diff) return 0;

    return (
      diff.summary.addedNodes +
      diff.summary.removedNodes +
      diff.summary.changedNodes +
      diff.summary.addedEdges +
      diff.summary.removedEdges
    );
  }, [diff]);

  return (
    <div>
      <header className="rounded-3xl border border-indigo-400/15 bg-gradient-to-br from-indigo-400/[0.09] via-slate-950 to-cyan-400/[0.06] p-6 shadow-2xl shadow-indigo-950/20">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
          Truvern Operations Â· ATLAS-04B
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Release Intelligence
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
          Compare the current Truvern architecture with an ATLAS release
          snapshot. Detect structural changes, new cycles, feature exposure,
          and release risk before deployment.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="min-w-[280px] flex-1">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Baseline snapshot
            </span>
            <select
              value={baseline}
              onChange={(event) => setBaseline(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-300/35"
            >
              <option value="">Latest snapshot</option>
              {payload?.snapshots.map((snapshot) => (
                <option key={snapshot.file} value={snapshot.file}>
                  {snapshot.name} Â· {formatDate(snapshot.createdAt)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={loading}
            onClick={() => void load(baseline || undefined)}
            className="rounded-xl bg-indigo-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Comparingâ€¦" : "Compare release"}
          </button>
        </div>
      </header>

      {failure ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-5 text-sm text-rose-100">
          <div className="font-semibold">Release Intelligence unavailable</div>
          <p className="mt-1 text-rose-200/75">{failure}</p>
        </div>
      ) : null}

      {diff ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <section
              className={`rounded-2xl border p-5 ${readinessClass(diff.readiness)}`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                Release readiness
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {diff.readiness.replace("_", " ")}
              </div>
              <p className="mt-2 text-sm opacity-75">
                Compared with {diff.baseline.name}
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Risk score
              </div>
              <div className="mt-2 text-3xl font-semibold text-white">
                {diff.riskScore}
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Architecture-weighted release exposure
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Structural changes
              </div>
              <div className="mt-2 text-3xl font-semibold text-white">
                {changeTotal}
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Nodes and dependency edges
              </p>
            </section>
          </div>

          <section className="mt-5 rounded-3xl border border-white/10 bg-slate-950/75 p-5">
            <h2 className="font-semibold text-white">Release change summary</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {metricLabels.map(([key, label]) => (
                <div
                  key={key}
                  className="rounded-xl border border-white/5 bg-white/[0.025] p-3"
                >
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    {diff.summary[key]}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <NodeList title="Added architecture assets" nodes={diff.addedNodes} />
                <NodeList
                  title="Removed architecture assets"
                  nodes={diff.removedNodes}
                />
              </div>

              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-semibold text-white">Changed assets</h3>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">
                    {diff.changedNodes.length}
                  </span>
                </div>
                {diff.changedNodes.length ? (
                  <div className="mt-3 max-h-[500px] space-y-2 overflow-y-auto pr-1">
                    {diff.changedNodes.map((change) => (
                      <div
                        key={change.id}
                        className="rounded-xl border border-white/5 bg-slate-950/55 px-3 py-3"
                      >
                        <div className="font-medium text-slate-100">
                          {change.after.label}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {change.after.type} Â· {change.id}
                        </div>
                        <div className="mt-2 text-xs text-amber-200">
                          Impact delta: {change.impactDelta >= 0 ? "+" : ""}
                          {change.impactDelta}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">None detected.</p>
                )}
              </section>

              <NodeList
                title="High-impact release changes"
                nodes={diff.highImpactChanges}
              />
            </div>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.045] p-4">
                <h3 className="font-semibold text-white">
                  Release reviewer checklist
                </h3>
                <div className="mt-3 space-y-3">
                  {diff.checklist.map((item) => (
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
                <h3 className="font-semibold text-white">Affected features</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {diff.affectedFeatures.length ? (
                    diff.affectedFeatures.map((feature) => (
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

              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <h3 className="font-semibold text-white">Cycle movement</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-rose-400/[0.07] px-3 py-3">
                    <div className="text-xs text-rose-200/70">New cycles</div>
                    <div className="mt-1 text-xl font-semibold text-rose-100">
                      {diff.newCycles.length}
                    </div>
                  </div>
                  <div className="rounded-xl bg-emerald-400/[0.07] px-3 py-3">
                    <div className="text-xs text-emerald-200/70">
                      Resolved cycles
                    </div>
                    <div className="mt-1 text-xl font-semibold text-emerald-100">
                      {diff.resolvedCycles.length}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm">
                <h3 className="font-semibold text-white">Baseline</h3>
                <dl className="mt-3 space-y-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Snapshot</dt>
                    <dd className="text-right text-slate-200">
                      {diff.baseline.name}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Created</dt>
                    <dd className="text-right text-slate-200">
                      {formatDate(diff.baseline.createdAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Nodes</dt>
                    <dd className="text-slate-200">
                      {diff.baseline.summary.nodes}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Edges</dt>
                    <dd className="text-slate-200">
                      {diff.baseline.summary.edges}
                    </dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>
        </>
      ) : loading ? (
        <section className="mt-5 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center text-sm text-slate-500">
          Comparing architecture snapshotsâ€¦
        </section>
      ) : null}
    </div>
  );
}

