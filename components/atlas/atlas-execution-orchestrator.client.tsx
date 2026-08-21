"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Patch = {
  id: string;
  title: string;
  phase: number;
  phaseLabel: string;
  risk: string;
  estimatedHours: number;
  estimatedScoreGain: number;
  state: string;
  checkpointReference: string | null;
  reviewer: string | null;
  approver: string | null;
  implementer: string | null;
  measuredImpact: {
    governanceScoreChange: number;
    rootCauseChange: number;
    dependencyCycleChange: number;
    detailedFindingChange: number;
  } | null;
};

type State = {
  updatedAt: string;
  summary: {
    totalPatches: number;
    counts: Record<string, number>;
    validatedPatches: number;
    failedPatches: number;
    completedScoreGain: number;
    remainingEstimatedScoreGain: number;
  };
  patches: Patch[];
};

const transitions: Record<string, string[]> = {
  PROPOSED: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "PROPOSED"],
  APPROVED: ["IMPLEMENTED", "IN_REVIEW"],
  IMPLEMENTED: ["VALIDATING", "ROLLED_BACK"],
  VALIDATING: [],
  VALIDATED: [],
  FAILED: ["IMPLEMENTED", "ROLLED_BACK"],
  ROLLED_BACK: [],
};

export default function AtlasExecutionOrchestrator() {
  const [state, setState] = useState<State | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actor, setActor] = useState("");
  const [checkpoint, setCheckpoint] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/truvern/atlas/execution-orchestrator", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
      setState(data);
      setSelectedId((current) => current ?? data.patches[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Execution orchestrator failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(
    () => state?.patches.find((patch) => patch.id === selectedId) ?? null,
    [state, selectedId],
  );

  const post = useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/truvern/atlas/execution-orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Action failed: ${response.status}`);
      setState(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Execution action failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div>
      <header className="rounded-3xl border border-emerald-400/15 bg-slate-950 p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
          Truvern Operations Â· ATLAS-09
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          Execution and Validation Orchestrator
        </h1>
        <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-400">
          Tracks human approval, implementation, validation, measured architecture impact,
          failure, and rollback for every review-only ATLAS patch.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {busy ? "Workingâ€¦" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => void post({ action: "sync" })}
            disabled={busy}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Sync patch queue
          </button>
        </div>
      </header>

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-5 text-rose-100">
          {error}
        </div>
      ) : null}

      {state ? (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["Total patches", state.summary.totalPatches],
              ["Validated", state.summary.validatedPatches],
              ["Failed", state.summary.failedPatches],
              ["Measured gain", state.summary.completedScoreGain],
              ["Remaining gain", state.summary.remainingEstimatedScoreGain],
              ["Updated", new Date(state.updatedAt).toLocaleTimeString()],
            ].map(([label, value]) => (
              <section key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
              </section>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
            <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-4">
              <h2 className="px-1 font-semibold text-white">Patch execution queue</h2>
              <div className="mt-4 max-h-[760px] space-y-3 overflow-y-auto">
                {state.patches.map((patch) => (
                  <button
                    key={patch.id}
                    type="button"
                    onClick={() => setSelectedId(patch.id)}
                    className={`w-full rounded-2xl border p-4 text-left ${
                      selectedId === patch.id
                        ? "border-emerald-300/30 bg-emerald-400/[0.08]"
                        : "border-white/10 bg-white/[0.025]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
                        {patch.id}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300">
                        {patch.state}
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold text-white">{patch.title}</h3>
                    <p className="mt-2 text-xs text-slate-500">
                      Phase {patch.phase} Â· {patch.risk} risk Â· {patch.estimatedHours}h
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {selected ? (
              <section className="space-y-5">
                <article className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                  <div className="text-xs uppercase tracking-[0.16em] text-emerald-300">
                    {selected.id} Â· Phase {selected.phase} Â· {selected.phaseLabel}
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{selected.title}</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    {[
                      ["State", selected.state],
                      ["Risk", selected.risk],
                      ["Effort", `${selected.estimatedHours}h`],
                      ["Expected gain", `+${selected.estimatedScoreGain}`],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                        <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</div>
                        <div className="mt-2 font-semibold text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                  <h3 className="font-semibold text-white">Execution controls</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <input
                      value={actor}
                      onChange={(event) => setActor(event.target.value)}
                      placeholder="Actor or approver"
                      className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
                    />
                    <input
                      value={checkpoint}
                      onChange={(event) => setCheckpoint(event.target.value)}
                      placeholder="Checkpoint path for implementation"
                      className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
                    />
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Optional note"
                      className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {(transitions[selected.state] || [])
                      .filter((target) => target !== "VALIDATING" && target !== "ROLLED_BACK")
                      .map((target) => (
                        <button
                          key={target}
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void post({
                              action: "transition",
                              patchId: selected.id,
                              target,
                              actor,
                              note,
                              checkpointReference: target === "IMPLEMENTED" ? checkpoint : undefined,
                            })
                          }
                          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Move to {target}
                        </button>
                      ))}

                    {["IMPLEMENTED", "FAILED"].includes(selected.state) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void post({ action: "validate", patchId: selected.id, actor })}
                        className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                      >
                        Run validation
                      </button>
                    ) : null}

                    {["IMPLEMENTED", "FAILED"].includes(selected.state) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void post({ action: "rollback", patchId: selected.id, actor, note })}
                        className="rounded-xl bg-rose-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                      >
                        Record rollback
                      </button>
                    ) : null}
                  </div>
                </article>

                <div className="grid gap-5 lg:grid-cols-2">
                  <article className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                    <h3 className="font-semibold text-white">Recorded responsibility</h3>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Reviewer</dt><dd className="text-white">{selected.reviewer || "Not recorded"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Approver</dt><dd className="text-white">{selected.approver || "Not recorded"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Implementer</dt><dd className="text-white">{selected.implementer || "Not recorded"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Checkpoint</dt><dd className="max-w-[65%] break-all text-right text-white">{selected.checkpointReference || "Not recorded"}</dd></div>
                    </dl>
                  </article>

                  <article className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                    <h3 className="font-semibold text-white">Measured impact</h3>
                    {selected.measuredImpact ? (
                      <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex justify-between"><dt className="text-slate-500">Governance score</dt><dd className="text-white">{selected.measuredImpact.governanceScoreChange}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Root causes</dt><dd className="text-white">{selected.measuredImpact.rootCauseChange}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Dependency cycles</dt><dd className="text-white">{selected.measuredImpact.dependencyCycleChange}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Detailed findings</dt><dd className="text-white">{selected.measuredImpact.detailedFindingChange}</dd></div>
                      </dl>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">
                        Impact is calculated after validation.
                      </p>
                    )}
                  </article>
                </div>
              </section>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

