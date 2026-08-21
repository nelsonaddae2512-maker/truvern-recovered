"use client";
import { useCallback, useEffect, useState } from "react";

type Result = {
  mode: "REVIEW_ONLY";
  summary: {
    patchesGenerated: number;
    affectedFiles: number;
    estimatedHours: number;
    estimatedScoreGain: number;
    highRiskPatches: number;
    mediumRiskPatches: number;
    lowRiskPatches: number;
  };
  patches: Array<{
    id: string;
    phase: number;
    phaseLabel: string;
    sourcePlanId: string;
    title: string;
    risk: string;
    affectedFileCount: number;
    estimatedHours: number;
    estimatedScoreGain: number;
    affectedFiles: string[];
  }>;
};

export default function AtlasPatchGenerator() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/truvern/atlas/patch-generator", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Patch generator failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <header className="rounded-3xl border border-cyan-400/15 bg-slate-950 p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Truvern Operations Â· ATLAS-08
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-white">Intelligent Patch Generator</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
          Generates reviewable patch work orders, file scopes, validation commands,
          rollback instructions, and empty candidate-diff placeholders. It never
          applies repository changes automatically.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="mt-5 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {loading ? "Generatingâ€¦" : "Regenerate patch queue"}
        </button>
      </header>

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-5 text-rose-100">
          {error}
        </div>
      ) : null}

      {result ? (
        <>
          <section className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
            Mode: <strong>{result.mode}</strong>. Candidate patch files are placeholders
            until reviewed against the actual repository state.
          </section>

          <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["Patches", result.summary.patchesGenerated],
              ["Affected files", result.summary.affectedFiles],
              ["Estimated effort", `${result.summary.estimatedHours}h`],
              ["Score gain", `+${result.summary.estimatedScoreGain}`],
              ["High risk", result.summary.highRiskPatches],
              ["Low risk", result.summary.lowRiskPatches],
            ].map(([label, value]) => (
              <section key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
              </section>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {result.patches.map((patch) => (
              <article key={patch.id} className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-cyan-300">
                  {patch.id} Â· Phase {patch.phase} Â· {patch.phaseLabel}
                </div>
                <h2 className="mt-2 text-lg font-semibold text-white">{patch.title}</h2>
                <p className="mt-2 text-sm text-slate-500">Source plan: {patch.sourcePlanId}</p>
                <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
                  <div><div className="text-slate-500">Risk</div><div className="mt-1 font-semibold text-white">{patch.risk}</div></div>
                  <div><div className="text-slate-500">Files</div><div className="mt-1 font-semibold text-white">{patch.affectedFileCount}</div></div>
                  <div><div className="text-slate-500">Effort</div><div className="mt-1 font-semibold text-white">{patch.estimatedHours}h</div></div>
                  <div><div className="text-slate-500">Gain</div><div className="mt-1 font-semibold text-emerald-200">+{patch.estimatedScoreGain}</div></div>
                </div>
                <div className="mt-4 max-h-40 space-y-2 overflow-y-auto">
                  {patch.affectedFiles.map((file) => (
                    <code key={file} className="block rounded-lg bg-white/[0.035] px-3 py-2 text-xs text-cyan-100">{file}</code>
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

