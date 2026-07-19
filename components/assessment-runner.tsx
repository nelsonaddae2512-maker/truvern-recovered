"use client";

import { useState } from "react";

type QuestionKind = "YES_NO" | "TEXT" | "SELECT" | "MULTI_SELECT" | "NUMBER";

type RunnerQuestion = {
  id: number;
  prompt: string;
  helpText?: string | null;
  kind: QuestionKind;
  required: boolean;
  key?: string | null;
  options: string[];
  existingValue: string;
};

type RunnerSection = {
  id: number;
  title: string;
  description?: string | null;
  order: number;
  questions: RunnerQuestion[];
};

type RunnerData = {
  assessmentId: number;
  vendorName: string;
  templateName: string;
  status: string;
  score: number | null;
  confidentialityScore: number | null;
  integrityScore: number | null;
  availabilityScore: number | null;
  sections: RunnerSection[];
};

type Props = {
  initialData: RunnerData;
};

export default function AssessmentRunner({ initialData }: Props) {
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const record: Record<number, string> = {};
    for (const section of initialData.sections) {
      for (const q of section.questions) record[q.id] = q.existingValue ?? "";
    }
    return record;
  });

  const [saving, setSaving] = useState<"draft" | "complete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [lastSavedScores, setLastSavedScores] = useState({
    score: initialData.score ?? null,
    confidentialityScore: initialData.confidentialityScore ?? null,
    integrityScore: initialData.integrityScore ?? null,
    availabilityScore: initialData.availabilityScore ?? null,
  });

  function updateAnswer(questionId: number, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSave(markComplete: boolean) {
    try {
      setError(null);
      setSaving(markComplete ? "complete" : "draft");

      const res = await fetch(`/api/assessments/${initialData.assessmentId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markComplete,
          answers: Object.entries(answers).map(([questionId, value]) => ({
            questionId: Number(questionId),
            value,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save answers");
      }

      const data = await res.json();
      setLastSavedScores({
        score: data.score ?? null,
        confidentialityScore: data.confidentialityScore ?? null,
        integrityScore: data.integrityScore ?? null,
        availabilityScore: data.availabilityScore ?? null,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to save assessment");
    } finally {
      setSaving(null);
    }
  }

  function scoreLabel(score: number | null) {
    if (score == null) return "Not scored yet";
    if (score >= 85) return `Strong (${score})`;
    if (score >= 70) return `Good (${score})`;
    if (score >= 50) return `Needs improvement (${score})`;
    return `Weak (${score})`;
  }

  function scoreTone(score: number | null) {
    if (score == null) return "text-slate-400";
    if (score >= 85) return "text-emerald-300";
    if (score >= 70) return "text-cyan-300";
    if (score >= 50) return "text-amber-300";
    return "text-rose-300";
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-4 shadow-lg shadow-black/40">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-slate-900/70 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Assessment in progress
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-semibold text-slate-50">
              {initialData.templateName}
            </h1>

            <p className="text-sm text-slate-300">
              Vendor: <span className="font-medium text-emerald-300">{initialData.vendorName}</span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-[11px] text-slate-400">Completion</p>
            <p className={"text-sm font-semibold " + scoreTone(lastSavedScores.score)}>
              {scoreLabel(lastSavedScores.score)}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-100">
            {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-4 shadow-lg shadow-black/40">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Answer the questionnaire
            </p>
            <p className="text-[11px] text-slate-500">
              Respond as the vendor would; add context where needed.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving === "draft"}
              onClick={() => handleSave(false)}
              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-200 hover:border-emerald-400 disabled:opacity-60"
            >
              {saving === "draft" ? "Saving draft..." : "Save draft"}
            </button>

            <button
              type="button"
              disabled={saving === "complete"}
              onClick={() => handleSave(true)}
              className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving === "complete" ? "Submitting..." : "Submit & score"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {initialData.sections.map((section) => (
            <div key={section.id} className="rounded-2xl border border-slate-800 bg-slate-950/90 px-3 py-3">
              <h2 className="text-sm font-semibold text-slate-100">{section.title}</h2>
              {section.description ? (
                <p className="text-[11px] text-slate-500">{section.description}</p>
              ) : null}

              <div className="mt-3 space-y-3">
                {section.questions.map((q) => {
                  const value = answers[q.id] ?? "";

                  return (
                    <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
                      <p className="text-[13px] text-slate-100">
                        {q.prompt}
                        {q.required ? <span className="ml-1 text-rose-400">*</span> : null}
                      </p>

                      {q.helpText ? (
                        <p className="mt-1 text-[11px] text-slate-500">{q.helpText}</p>
                      ) : null}

                      <div className="mt-3">
                        {q.kind === "YES_NO" ? (
                          <select value={value} onChange={(e) => updateAnswer(q.id, e.target.value)} className="input-runner">
                            <option value="">Select an answer</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                            <option value="N/A">N/A</option>
                          </select>
                        ) : q.kind === "NUMBER" ? (
                          <input type="number" value={value} onChange={(e) => updateAnswer(q.id, e.target.value)} className="input-runner" placeholder="Enter a numeric value" />
                        ) : q.kind === "SELECT" ? (
                          <select value={value} onChange={(e) => updateAnswer(q.id, e.target.value)} className="input-runner">
                            <option value="">Select an option</option>
                            {q.options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : q.kind === "MULTI_SELECT" ? (
                          <div className="space-y-2">
                            {q.options.map((opt) => {
                              const selected = value.split("|").map((v) => v.trim()).filter(Boolean);
                              const checked = selected.includes(opt);

                              return (
                                <label key={opt} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-[12px] text-slate-100">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = new Set(selected);
                                      if (e.target.checked) next.add(opt);
                                      else next.delete(opt);
                                      updateAnswer(q.id, Array.from(next).join("|"));
                                    }}
                                    className="h-4 w-4 accent-emerald-400"
                                  />
                                  <span>{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <textarea value={value} onChange={(e) => updateAnswer(q.id, e.target.value)} rows={3} className="input-runner resize-none" placeholder="Type your response here." />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}


