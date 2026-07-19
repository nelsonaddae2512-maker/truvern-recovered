"use client";

import { useEffect, useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function qText(q: any) {
  return q?.text ?? q?.prompt ?? q?.title ?? `Question #${q?.id ?? "€”"}`;
}

function qOrder(q: any) {
  const oi = Number(q?.orderIndex);
  if (Number.isFinite(oi)) return oi;
  const o = Number(q?.order);
  if (Number.isFinite(o)) return o;
  return 9999;
}

function normalizeType(t: any): string {
  const s = String(t ?? "").toUpperCase();
  // Support common variants
  if (s === "YES_NO") return "BOOLEAN";
  if (s === "BOOL") return "BOOLEAN";
  return s || "TEXT";
}

type Props = {
  assessmentId: number;
  vendorId: number;
  token: string;
  submitted?: boolean;
  questions: any[];
  initialAnswers: any[];
};

export default function VendorAssessmentRunClient({
  assessmentId,
  vendorId,
  token,
  submitted = false,
  questions,
  initialAnswers,
}: Props) {
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialMap = useMemo(() => {
    const m = new Map<number, any>();
    for (const a of initialAnswers ?? []) {
      const qid = Number(a?.questionId);
      if (Number.isFinite(qid)) m.set(qid, a);
    }
    return m;
  }, [initialAnswers]);

  const [answers, setAnswers] = useState<Map<number, any>>(initialMap);

  useEffect(() => {
    // keep state in sync if server revalidates
    setAnswers(initialMap);
  }, [initialMap]);

  const sorted = useMemo(() => {
    return [...(questions ?? [])].sort((a, b) => qOrder(a) - qOrder(b));
  }, [questions]);

  const answeredCount = useMemo(() => {
    let n = 0;
    for (const q of sorted) {
      const qid = Number(q?.id);
      if (!Number.isFinite(qid)) continue;
      const a = answers.get(qid);
      if (!a) continue;
      if (a.value === null || a.value === undefined || String(a.value).trim() === "") continue;
      n += 1;
    }
    return n;
  }, [answers, sorted]);

  const scorePreview = useMemo(() => {
    // Lightweight preview: boolean true = 1, boolean false = 0, text filled = 1
    // (Real scoring engine can replace this later.)
    let possible = 0;
    let earned = 0;

    for (const q of sorted) {
      const qid = Number(q?.id);
      if (!Number.isFinite(qid)) continue;
      const type = normalizeType(q?.type);
      const a = answers.get(qid);
      const rawVal = a?.valueJson ?? a?.value;
            const val =
              rawVal === "true" ? true :
              rawVal === "false" ? false :
              rawVal;

      if (type === "BOOLEAN") {
        possible += 1;
        if (val === true) earned += 1;
      } else {
        possible += 1;
        if (val != null && String(val).trim().length > 0) earned += 1;
      }
    }

    if (!possible) return 0;
    return Math.round((earned / possible) * 100);
  }, [answers, sorted]);

  async function saveAnswer(questionId: number, value: any) {
    setError(null);
    setSaving(questionId);

    // optimistic update
    setAnswers((prev) => {
      const next = new Map(prev);
      const existing = next.get(questionId) ?? { questionId };
      next.set(questionId, { ...existing, questionId, value, updatedAt: new Date().toISOString() });
      return next;
    });

    try {
      const res = await fetch("/vendor-portal/assessment-answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
  assessmentId,
  vendorId,
  questionId,
  value,
  token,
}),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);

        if (res.status === 403) {
          throw new Error(
            "Your vendor review session is no longer authorized.",
          );
        }

        if (res.status === 404) {
          throw new Error(
            "This assessment is no longer available.",
          );
        }

        throw new Error(
          payload?.error ||
          payload?.message ||
          `Save failed (${res.status})`,
        );
      }

      const data = await res.json().catch(() => null);
      if (data?.answer?.questionId) {
        setAnswers((prev) => {
          const next = new Map(prev);
          next.set(Number(data.answer.questionId), data.answer);
          return next;
        });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save answer.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-50">Questions</div>
          <div className="mt-1 text-xs text-slate-200/60">
            Progress:{" "}
            <span className="font-semibold text-slate-50">
              {answeredCount}/{sorted.length}
            </span>{" "}
            • Score preview: <span className="font-semibold text-slate-50">{scorePreview}%</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-slate-200/60">
            {saving ? "Saving..." : "Autosave enabled"}
          </div>

          {!submitted ? (
            <button
              type="button"
              disabled={saving !== null || submitted}
              onClick={async () => {
                const response = await fetch("/vendor-portal/assessment-submit", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ assessmentId, vendorId, token }),
                });

                const data = await response.json().catch(() => null);

                if (!response.ok || !data?.ok) {
                  alert(data?.error || "Failed to submit assessment.");
                  return;
                }

                window.location.reload();
              }}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
            >
              Submit assessment
            </button>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200">
              Submitted
            </div>
          )}

          {error ? (
            <div className="max-w-md text-right text-xs font-semibold text-rose-200">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-6 text-sm text-slate-200/70">No questions found for this assessment.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {sorted.map((q) => {
            const qid = Number(q?.id);
            const type = normalizeType(q?.type);
            const a = Number.isFinite(qid) ? answers.get(qid) : null;
            const rawVal = a?.valueJson ?? a?.value;
            const val =
              rawVal === "true" ? true :
              rawVal === "false" ? false :
              rawVal;

            return (
              <div key={qid} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200/60">
                      Q{qOrder(q)} • {type}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-50">{qText(q)}</div>
                  </div>

                  <div className="shrink-0">
                    {val === null || val === undefined || (typeof val === "string" && val.trim() === "") ? (
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200/70">
                        Unanswered
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                        Answered
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  {type === "BOOLEAN" ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => !submitted && saveAnswer(qid, true)}
                        className={clsx(
                          "rounded-lg border px-3 py-2 text-sm font-semibold",
                          val === true
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-white/10 bg-white/5 text-slate-50 hover:bg-white/10"
                        )}
                        disabled={saving === qid}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => !submitted && saveAnswer(qid, false)}
                        className={clsx(
                          "rounded-lg border px-3 py-2 text-sm font-semibold",
                          val === false
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                            : "border-white/10 bg-white/5 text-slate-50 hover:bg-white/10"
                        )}
                        disabled={saving === qid}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => !submitted && saveAnswer(qid, null)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-white/10"
                        disabled={saving === qid}
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <div>
                      <textarea
                        className="min-h-[84px] w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        placeholder="Type your response..."
                        value={val == null ? "" : String(val)}
                        onChange={(e) => {
                          const next = e.target.value;
                          setAnswers((prev) => {
                            const m = new Map(prev);
                            const existing = m.get(qid) ?? { questionId: qid };
                            m.set(qid, { ...existing, questionId: qid, value: next });
                            return m;
                          });
                        }}
                        onBlur={(e) => saveAnswer(qid, e.target.value)}
                        disabled={saving === qid}
                      />
                      <div className="mt-2 text-xs text-slate-200/50">
                        Tip: response autosaves when you click outside the field.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

















