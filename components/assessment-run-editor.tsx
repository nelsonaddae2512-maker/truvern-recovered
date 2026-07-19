"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Question = {
  id: number;
  text?: string | null;
  prompt?: string | null;
  title?: string | null;
  type?: string | null;

  options?: any;
  choices?: any;

  sectionId?: number | null;
  assessmentSectionId?: number | null;
  section_id?: number | null;

  section?: any;
  assessmentSection?: any;

  required?: boolean | null;
};

type Answer = {
  id: number;
  assessmentId: number;
  questionId?: number | null;
  value?: any;
  updatedAt?: string | null;
};

type Props = {
  assessmentId: number;
  initialStatus: string;
  questions: Question[];
  initialAnswers: Answer[];
  backHref?: string;
};

function qLabel(q: Question) {
  return q.text ?? q.prompt ?? q.title ?? `Question #${q.id}`;
}

function sectionKeyFor(q: Question) {
  return (
    q.sectionId ??
    q.assessmentSectionId ??
    q.section_id ??
    q.section?.id ??
    q.assessmentSection?.id ??
    0
  );
}

function sectionTitleFor(q: Question) {
  return (
    q.section?.title ??
    q.assessmentSection?.title ??
    (sectionKeyFor(q) ? `Section ${sectionKeyFor(q)}` : "Questions")
  );
}

function isAnswered(v: any) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return false;
}

function normalizeYesNo(val: any): boolean {
  if (val === true) return true;
  if (val === false) return false;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "yes" || s === "true" || s === "1") return true;
    if (s === "no" || s === "false" || s === "0") return false;
  }
  return false;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function safeJson(res: Response) {
  const txt = await res.text().catch(() => "");
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return { ok: false, error: txt };
  }
}

/**
 * UI convenience normalization:
 * - empty strings -> null (treat as "clear")
 * - numbers: keep as number if finite; otherwise null
 * - objects/arrays/booleans: pass through (API normalizes)
 */
function normalizeValueForSave(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === "string") {
    const s = value.trim();
    return s.length ? s : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  // boolean, object, array => pass through
  return value;
}

export default function AssessmentRunEditor({
  assessmentId,
  initialStatus,
  questions,
  initialAnswers,
  backHref = "/assessment/runs",
}: Props) {
  const router = useRouter();

  const [status, setStatus] = useState(initialStatus);

  const [answers, setAnswers] = useState<Record<number, any>>(() => {
    const m: Record<number, any> = {};
    for (const a of initialAnswers ?? []) {
      if (a.questionId != null) m[a.questionId] = a.value;
    }
    return m;
  });

  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [savedTick, setSavedTick] = useState<Record<number, number>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<number, { title: string; items: Question[] }>();
    for (const q of questions ?? []) {
      const key = sectionKeyFor(q);
      const title = sectionTitleFor(q);
      if (!map.has(key)) map.set(key, { title, items: [] });
      map.get(key)!.items.push(q);
    }
    return Array.from(map.entries()).map(([key, v]) => ({
      key,
      title: v.title,
      items: v.items,
    }));
  }, [questions]);

  const sectionStats = useMemo(() => {
    const out: Record<number, { answered: number; total: number; complete: boolean }> = {};
    for (const s of grouped) {
      const total = s.items.length;
      const answered = s.items.reduce((n, q) => n + (isAnswered(answers[q.id]) ? 1 : 0), 0);
      out[s.key] = {
        answered,
        total,
        complete: total > 0 && answered === total,
      };
    }
    return out;
  }, [grouped, answers]);

  const overallAnswered = useMemo(() => {
    let n = 0;
    for (const q of questions) if (isAnswered(answers[q.id])) n++;
    return n;
  }, [questions, answers]);

  const completedSections = useMemo(() => {
    return grouped.reduce((n, s) => n + (sectionStats[s.key]?.complete ? 1 : 0), 0);
  }, [grouped, sectionStats]);

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const touched = useRef<Record<number, boolean>>({});
  const prevComplete = useRef<Record<number, boolean>>({});

  useEffect(() => {
    const next: Record<number, boolean> = {};
    for (const s of grouped) next[s.key] = !!sectionStats[s.key]?.complete;
    setCollapsed((prev) => ({ ...next, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped.length]);

  useEffect(() => {
    const next: Record<number, boolean> = { ...collapsed };
    let changed = false;

    for (const s of grouped) {
      const key = s.key;
      const nowComplete = !!sectionStats[key]?.complete;
      const wasComplete = !!prevComplete.current[key];
      prevComplete.current[key] = nowComplete;

      if (!wasComplete && nowComplete && !touched.current[key]) {
        next[key] = true;
        changed = true;
      }
    }
    if (changed) setCollapsed(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionStats]);

  function setAllCollapsed(value: boolean) {
    const next: Record<number, boolean> = {};
    for (const s of grouped) next[s.key] = value;
    setCollapsed(next);
  }

  function collapseCompletedNow() {
    const next: Record<number, boolean> = { ...collapsed };
    for (const s of grouped) if (sectionStats[s.key]?.complete) next[s.key] = true;
    setCollapsed(next);
  }

  function toggleSection(key: number) {
    touched.current[key] = true;
    setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  }

  async function submitRunInternal() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/assessment-runs/${assessmentId}/submit`, {
        method: "POST",
        credentials: "include",
      });
      const data = await safeJson(r);
      if (!r.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);

      const nextStatus = data?.assessment?.status;
      setStatus(typeof nextStatus === "string" ? nextStatus : "COMPLETED");
      router.refresh();
      return true;
    } catch (e: any) {
      setSubmitError(e?.message ?? "Submit failed");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAnswer(questionId: number, value: any) {
    if (status === "COMPLETED" || status === "ARCHIVED") return;

    setSaveError(null);
    setSaving((p) => ({ ...p, [questionId]: true }));

    try {
      const normalized = normalizeValueForSave(value);

      const r = await fetch("/api/assessment/answers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, questionId, value: normalized }),
      });

      const data = await safeJson(r);

      // Locked/Completed => show clean message
      if (r.status === 409) {
        setSaveError(data?.error ?? "Assessment is locked");
        return;
      }

      if (!r.ok || !data?.ok) {
        const msg = data?.error ?? `HTTP ${r.status}`;
        throw new Error(msg);
      }

      setSavedTick((p) => ({ ...p, [questionId]: Date.now() }));

      const nextStatus = data?.assessment?.status;
      if (typeof nextStatus === "string" && nextStatus !== status) {
        setStatus(nextStatus);
      }

      router.refresh();
    } catch (e: any) {
      setSaveError(e?.message ?? "Save failed");
    } finally {
      setSaving((p) => ({ ...p, [questionId]: false }));
    }
  }

  async function submitRun() {
    await submitRunInternal();
  }

  async function reopenRun() {
    setReopenError(null);
    setReopening(true);
    try {
      const r = await fetch(`/api/assessment-runs/${assessmentId}/reopen`, {
        method: "POST",
        credentials: "include",
      });
      const data = await safeJson(r);
      if (!r.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);

      setStatus("IN_PROGRESS");
      router.refresh();
    } catch (e: any) {
      setReopenError(e?.message ?? "Reopen failed");
    } finally {
      setReopening(false);
    }
  }

  function questionMeta(q: Question, v: any) {
    const t = (q.type ?? "").toUpperCase();
    const answered = isAnswered(v);
    const required = !!q.required;
    return { t, answered, required };
  }

  // -------- Navigator / active section ----------
  const sectionIds = useMemo(
    () => grouped.map((s) => `sec-${assessmentId}-${s.key}`),
    [grouped, assessmentId]
  );
  const [activeSectionKey, setActiveSectionKey] = useState<number | null>(null);

  useEffect(() => {
    if (!sectionIds.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visibles = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));

        if (!visibles.length) return;

        const id = visibles[0].target.getAttribute("id") || "";
        const match = id.match(/sec-\d+-(\d+)$/);
        if (!match) return;

        const key = Number(match[1]);
        if (!Number.isFinite(key)) return;

        setActiveSectionKey(key);
      },
      { threshold: [0.15, 0.25, 0.35, 0.5, 0.65] }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }

    return () => obs.disconnect();
  }, [sectionIds]);

  function scrollToSection(key: number) {
    const el = document.getElementById(`sec-${assessmentId}-${key}`);
    if (!el) return;
    setCollapsed((p) => ({ ...p, [key]: false }));
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function scrollToQuestion(qid: number) {
    const el = document.getElementById(`q-${assessmentId}-${qid}`);
    if (!el) return;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function findNextUnanswered(): { sectionKey: number; questionId: number } | null {
    for (const s of grouped) {
      for (const q of s.items) {
        if (!isAnswered(answers[q.id])) return { sectionKey: s.key, questionId: q.id };
      }
    }
    return null;
  }

  const nextUnanswered = useMemo(() => findNextUnanswered(), [grouped, answers]);

  function goNextUnanswered() {
    if (!nextUnanswered) return;
    setCollapsed((p) => ({ ...p, [nextUnanswered.sectionKey]: false }));
    scrollToSection(nextUnanswered.sectionKey);
    setTimeout(() => scrollToQuestion(nextUnanswered.questionId), 220);
  }

  function renderInput(q: Question) {
    const v = answers[q.id];
    const { t } = questionMeta(q, v);

    if (t === "YES_NO" || t === "BOOLEAN") {
      const checked = normalizeYesNo(v);

      return (
        <label className="inline-flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={checked}
            disabled={status === "COMPLETED" || status === "ARCHIVED"}
            onChange={(e) => {
              const next = e.target.checked;
              setAnswers((p) => ({ ...p, [q.id]: next }));
              saveAnswer(q.id, next);
            }}
            className="h-4 w-4 accent-emerald-400"
          />
          <span>{checked ? "Yes" : "No"}</span>
        </label>
      );
    }

    if (t === "NUMBER") {
      const shown = typeof v === "number" ? v : typeof v === "string" ? v : "";
      return (
        <input
          type="number"
          value={shown}
          disabled={status === "COMPLETED" || status === "ARCHIVED"}
          onChange={(e) => {
            const raw = e.target.value;
            const next = raw === "" ? "" : Number(raw);
            setAnswers((p) => ({ ...p, [q.id]: next }));
          }}
          onBlur={() => saveAnswer(q.id, answers[q.id])}
          className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
      );
    }

    const textVal = typeof v === "string" ? v : v ?? "";
    return (
      <textarea
        value={textVal}
        disabled={status === "COMPLETED" || status === "ARCHIVED"}
        onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
        onBlur={() => saveAnswer(q.id, answers[q.id])}
        rows={3}
        placeholder="Type your answer€¦"
        className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
      />
    );
  }

  const progressPct = questions.length ? Math.round((overallAnswered / questions.length) * 100) : 0;

  const showResultsPanel = status === "COMPLETED";
  const resultsHref = `/assessment/runs/${assessmentId}/results`;
  const findingsHref = `/issues?assessmentId=${assessmentId}`;

  const allAnswered = questions.length > 0 && overallAnswered === questions.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-5">
      {/* Left rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 shadow-lg shadow-black/30">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Navigator
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Progress</span>
                <span className="font-semibold text-slate-200">{progressPct}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-emerald-500/70"
                  style={{ width: `${clamp(progressPct, 0, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Answered {overallAnswered}/{questions.length}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={goNextUnanswered}
                disabled={!nextUnanswered}
                className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Next unanswered
              </button>
              <button
                type="button"
                onClick={collapseCompletedNow}
                className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              >
                Collapse completed
              </button>

              {showResultsPanel ? (
                <Link
                  href={resultsHref}
                  className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15"
                >
                  View results †—
                </Link>
              ) : null}
            </div>

            <div className="mt-4 space-y-1">
              {grouped.map((s) => {
                const stats = sectionStats[s.key] ?? {
                  answered: 0,
                  total: s.items.length,
                  complete: false,
                };
                const active = activeSectionKey === s.key;

                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => scrollToSection(s.key)}
                    className={
                      "w-full rounded-2xl border px-3 py-2 text-left transition " +
                      (active
                        ? "border-emerald-400/50 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-950/40 hover:bg-slate-900/60")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {s.title}
                      </div>
                      {stats.complete ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          Done
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                          {stats.answered}/{stats.total}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {collapsed[s.key] ? "Collapsed" : "Expanded"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="space-y-5">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/60 px-4 py-4 shadow-lg shadow-black/40">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-100">
                Assessment Run #{assessmentId}
              </div>
              <div className="text-xs text-slate-400">
                Status: <span className="font-semibold text-slate-200">{status}</span> €¢ Answered{" "}
                <span className="font-semibold text-slate-200">
                  {overallAnswered}/{questions.length}
                </span>{" "}
                €¢ Sections{" "}
                <span className="font-semibold text-slate-200">
                  {completedSections}/{grouped.length}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={backHref}
                className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              >
                Back to Assessments
              </a>

              <button
                type="button"
                onClick={() => setAllCollapsed(false)}
                className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              >
                Expand all
              </button>

              <button
                type="button"
                onClick={() => setAllCollapsed(true)}
                className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              >
                Collapse all
              </button>

              <button
                type="button"
                onClick={goNextUnanswered}
                disabled={!nextUnanswered}
                className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
              >
                Next unanswered
              </button>

              {status === "COMPLETED" ? (
                <>
                  <Link
                    href={resultsHref}
                    className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15"
                  >
                    View Results †—
                  </Link>
                  <button
                    type="button"
                    onClick={reopenRun}
                    disabled={reopening}
                    className="rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/15 disabled:opacity-60"
                  >
                    {reopening ? "Reopening€¦" : "Reopen"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={submitRun}
                  disabled={submitting || (status !== "COMPLETED" && !allAnswered)}
                  className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                  title={!allAnswered ? "Answer all questions to complete the run." : undefined}
                >
                  {submitting ? "Submitting€¦" : "Complete Run"}
                </button>
              )}
            </div>
          </div>

          {saveError ? (
            <div className="mt-3 text-xs text-rose-200">Save error: {saveError}</div>
          ) : null}
          {submitError ? (
            <div className="mt-3 text-xs text-rose-200">Submit error: {submitError}</div>
          ) : null}
          {reopenError ? (
            <div className="mt-3 text-xs text-rose-200">Reopen error: {reopenError}</div>
          ) : null}

          <div className="mt-3 text-[11px] text-slate-500">
            Runs only complete when you click <span className="text-slate-200 font-semibold">Complete Run</span>.
          </div>
        </section>

        {grouped.map((s) => {
          const stats = sectionStats[s.key] ?? {
            answered: 0,
            total: s.items.length,
            complete: false,
          };
          const isCollapsed = !!collapsed[s.key];
          const secId = `sec-${assessmentId}-${s.key}`;

          return (
            <section
              key={s.key}
              id={secId}
              className="rounded-3xl border border-slate-800 bg-slate-950/50 shadow-lg shadow-black/30 scroll-mt-24"
            >
              <button
                type="button"
                onClick={() => toggleSection(s.key)}
                className="w-full px-4 py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-slate-100">{s.title}</div>

                  {stats.complete ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                      Complete
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      {stats.answered}/{stats.total}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-400">{isCollapsed ? "–¸" : "–¾"}</div>
              </button>

              {!isCollapsed ? (
                <div className="px-4 pb-5 space-y-3">
                  {s.items.map((q) => {
                    const v = answers[q.id];
                    const meta = questionMeta(q, v);
                    const isSaving = !!saving[q.id];
                    const savedAt = savedTick[q.id];

                    return (
                      <div
                        key={q.id}
                        id={`q-${assessmentId}-${q.id}`}
                        className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 scroll-mt-28"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="text-sm font-semibold text-slate-100">{qLabel(q)}</div>
                            <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                              <span>Q{q.id}</span>
                              {meta.required ? (
                                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-200">
                                  Required
                                </span>
                              ) : null}
                              {meta.answered ? (
                                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-200">
                                  Answered
                                </span>
                              ) : (
                                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 font-semibold text-slate-300">
                                  Unanswered
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-xs text-slate-500">
                            {status === "COMPLETED"
                              ? "Saved"
                              : isSaving
                              ? "Saving€¦"
                              : savedAt
                              ? "Saved"
                              : ""}
                          </div>
                        </div>

                        <div className="mt-3">{renderInput(q)}</div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}

        {/* Results section */}
        <section
          id="results"
          className="rounded-3xl border border-slate-800 bg-slate-950/60 px-4 py-4 shadow-lg shadow-black/40"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-100">Results</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Snapshot summary for this run. Full breakdown lives on the Results page.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={resultsHref}
                className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15"
              >
                View full results †—
              </Link>
              <Link
                href={findingsHref}
                className="rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/15"
              >
                Open findings †—
              </Link>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
              <p className="text-slate-400 text-[11px]">Status</p>
              <p className="text-slate-100 font-semibold">{status}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
              <p className="text-slate-400 text-[11px]">Answered</p>
              <p className="text-slate-100 font-semibold">
                {overallAnswered}/{questions.length} ({progressPct}%)
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
              <p className="text-slate-400 text-[11px]">Sections complete</p>
              <p className="text-slate-100 font-semibold">
                {completedSections}/{grouped.length}
              </p>
            </div>
          </div>

          {status !== "COMPLETED" ? (
            <div className="mt-3 text-[11px] text-slate-500">
              Complete the run to finalize scoring + generate findings.
            </div>
          ) : (
            <div className="mt-3 text-[11px] text-emerald-200/80">
              This run is completed €” results & findings are available.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


