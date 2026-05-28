"use client";

import { useMemo, useState } from "react";

type AnswerItem = {
  id: string;
  question: string;
  answer: string;
  controlId?: string | null;
  evidenceCount: number;
};

function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replaceAll("â€¢", "•")
    .replaceAll("â€”", "—")
    .replaceAll("â€“", "–")
    .replaceAll("â€˜", "'")
    .replaceAll("â€™", "'")
    .replaceAll("â€œ", "\"")
    .replaceAll("â€", "\"")
    .trim();
}

function evidenceCount(value: any) {
  const evidence = value?.evidence ?? value?.attachments ?? value?.files ?? value?.evidenceUrls;

  if (Array.isArray(evidence)) return evidence.length;
  if (evidence && typeof evidence === "object") return Object.keys(evidence).length;
  if (typeof evidence === "string" && evidence.trim()) return 1;

  return 0;
}

function extractAnswers(payload: any): AnswerItem[] {
  const root = safeObject(payload);

  const candidates = [
    root.answers,
    root.responses,
    root.questionnaireAnswers,
    root.vendorAnswers,
    root.items,
    root.controls,
    root.assessmentAnswers,
    root.response?.answers,
    root.response?.responses,
    root.metadata?.answers,
  ];

  const arraySource = candidates.find(Array.isArray);

  if (Array.isArray(arraySource)) {
    return arraySource.map((item: any, index: number) => {
      const row = safeObject(item);

      return {
        id: cleanText(row.id ?? row.questionId ?? row.controlId ?? index),
        question:
          cleanText(row.question ?? row.prompt ?? row.label ?? row.control ?? row.controlId) ||
          `Question ${index + 1}`,
        answer:
          cleanText(row.answer ?? row.value ?? row.response ?? row.status ?? row.choice) ||
          "No answer recorded",
        controlId: cleanText(row.controlId ?? row.questionId) || null,
        evidenceCount: evidenceCount(row),
      };
    });
  }

  return Object.entries(root)
    .filter(([key, value]) => {
      if (["truvernReviewerIntelligence", "truvernRemediation", "governanceReleaseSnapshot"].includes(key)) {
        return false;
      }

      if (value === null || value === undefined) return false;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
      if (typeof value === "object") {
        const obj = safeObject(value);
        return !!(obj.answer ?? obj.value ?? obj.response ?? obj.status);
      }

      return false;
    })
    .slice(0, 100)
    .map(([key, value], index) => {
      const obj = safeObject(value);

      return {
        id: key,
        question: cleanText(obj.question ?? obj.prompt ?? obj.label ?? key) || `Question ${index + 1}`,
        answer: cleanText(obj.answer ?? obj.value ?? obj.response ?? obj.status ?? value) || "No answer recorded",
        controlId: cleanText(obj.controlId ?? key) || null,
        evidenceCount: evidenceCount(obj),
      };
    });
}

function answerTone(answer: string) {
  const value = answer.toUpperCase();

  if (value === "NO" || value.includes("NO ") || value.includes("FALSE")) {
    return "border-red-400/30 bg-red-500/15 text-red-100";
  }

  if (value.includes("PARTIAL") || value.includes("IN PROGRESS") || value.includes("PLANNED")) {
    return "border-amber-400/30 bg-amber-500/15 text-amber-100";
  }

  if (value === "YES" || value.includes("YES")) {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-100";
  }

  return "border-slate-400/30 bg-slate-500/15 text-slate-100";
}

export default function CompactSubmittedAnswersPanel({ responses }: { responses: any }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");

  const answers = useMemo(() => extractAnswers(responses), [responses]);

  const filtered = answers.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    return `${item.question} ${item.answer} ${item.controlId ?? ""}`.toLowerCase().includes(q);
  });

  const visible = expanded ? filtered : filtered.slice(0, 6);

  const answeredCount = answers.filter((item) => item.answer && item.answer !== "No answer recorded").length;
  const evidenceTotal = answers.reduce((sum, item) => sum + item.evidenceCount, 0);

  return (
    <section className="rounded-3xl border border-white/10 bg-[#050b1a]/80 p-5 shadow-[0_0_40px_rgba(8,145,178,0.08)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">
            Submitted questionnaire
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Vendor answers
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Compact answer review. Expand only when you need the full response detail.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/20"
        >
          {expanded ? "Collapse answers" : `Expand answers (${answers.length})`}
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total answers</p>
          <p className="mt-2 text-2xl font-semibold text-white">{answers.length}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Answered</p>
          <p className="mt-2 text-2xl font-semibold text-white">{answeredCount}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Evidence refs</p>
          <p className="mt-2 text-2xl font-semibold text-white">{evidenceTotal}</p>
        </div>
      </div>

      {expanded ? (
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
          placeholder="Search answers, controls, or response text..."
        />
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
        {visible.length ? visible.map((item, index) => (
          <details key={`${item.id}-${index}`} className="group border-b border-white/10 last:border-b-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-bold uppercase ${answerTone(item.answer)}`}>
                    {item.answer.length > 20 ? item.answer.slice(0, 20) + "..." : item.answer}
                  </span>

                  {item.controlId ? (
                    <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-slate-300">
                      {item.controlId}
                    </span>
                  ) : null}

                  {item.evidenceCount > 0 ? (
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[11px] text-emerald-100">
                      {item.evidenceCount} evidence
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 truncate text-sm font-semibold text-white">
                  {item.question}
                </p>
              </div>

              <span className="shrink-0 text-slate-400">⌄</span>
            </summary>

            <div className="border-t border-white/10 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Question</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{item.question}</p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Answer</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.answer}</p>
            </div>
          </details>
        )) : (
          <div className="p-4 text-sm text-slate-400">
            No submitted answers were found in this response payload.
          </div>
        )}
      </div>

      {!expanded && filtered.length > visible.length ? (
        <p className="mt-3 text-xs text-slate-500">
          Showing first {visible.length} of {filtered.length}. Expand to review all answers.
        </p>
      ) : null}
    </section>
  );
}
