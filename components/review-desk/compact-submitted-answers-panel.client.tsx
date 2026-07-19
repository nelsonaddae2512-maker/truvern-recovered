"use client";

function displaySubmittedAnswerLabel(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "true" || raw === "yes") return "Yes";
  if (raw === "false" || raw === "no") return "No";
  if (raw === "partial") return "Partial";
  if (raw === "not_applicable" || raw === "na") return "N/A";

  return String(value ?? "Unanswered");
}

import { useMemo, useState } from "react";

type VendorAnswer = {
  assessmentId?: number;
  assessmentStatus?: string;
  score?: number | null;
  questionId?: number;
  prompt?: string;
  questionType?: string;
  value?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AnswerItem = {
  id: string;
  question: string;
  answer: string;
  controlId?: string | null;
  evidenceCount: number;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .replaceAll("€¢", "•")
    .replaceAll("€”", "—")
    .replaceAll("€“", "–")
    .replaceAll("€˜", "'")
    .replaceAll("€™", "'")
    .replaceAll("€œ", "\"")
    .replaceAll("€", "\"")
    .trim();
}

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function answerTone(answer: string) {
  const value = answer.toUpperCase();

  if (value === "NO" || value.startsWith("NO ") || value.includes("FALSE")) {
    return "border-red-400/30 bg-red-500/15 text-red-100";
  }

  if (value.includes("PARTIAL") || value.includes("IN PROGRESS") || value.includes("PLANNED")) {
    return "border-amber-400/30 bg-amber-500/15 text-amber-100";
  }

  if (value === "YES" || value.includes("YES")) {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-100";
  }

  return "border-cyan-400/30 bg-cyan-500/15 text-cyan-100";
}

function fromVendorAnswers(vendorAnswers: VendorAnswer[]): AnswerItem[] {
  return vendorAnswers.map((answer, index) => ({
    id: `${answer.assessmentId ?? "assessment"}-${answer.questionId ?? index}`,
    question: cleanText(answer.prompt) || `Question ${answer.questionId ?? index + 1}`,
    answer: displaySubmittedAnswerLabel(answer.value),
    controlId: answer.questionId ? `Question #${answer.questionId}` : null,
    evidenceCount: 0,
  }));
}

function fromResponsePayload(payload: any): AnswerItem[] {
  const root = safeObject(payload);
  const possibleArrays = [
    root.answers,
    root.responses,
    root.questionnaireAnswers,
    root.vendorAnswers,
    root.items,
    root.controls,
  ];

  const source = possibleArrays.find(Array.isArray);

  if (!Array.isArray(source)) return [];

  return source.map((item: any, index: number) => {
    const row = safeObject(item);

    return {
      id: cleanText(row.id ?? row.questionId ?? row.controlId ?? index),
      question: cleanText(row.question ?? row.prompt ?? row.label ?? row.control ?? row.controlId) || `Question ${index + 1}`,
      answer: cleanText(row.answer ?? row.value ?? row.response ?? row.status ?? row.choice) || "No answer recorded",
      controlId: cleanText(row.controlId ?? row.questionId) || null,
      evidenceCount: safeArray(row.evidence ?? row.attachments ?? row.files).length,
    };
  });
}

export default function CompactSubmittedAnswersPanel({
  responses,
  vendorAnswers = [],
}: {
  responses: any;
  vendorAnswers?: VendorAnswer[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");

  const answers = useMemo(() => {
    const realVendorAnswers = fromVendorAnswers(vendorAnswers);
    return realVendorAnswers.length ? realVendorAnswers : fromResponsePayload(responses);
  }, [responses, vendorAnswers]);

  const filtered = answers.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${item.question} ${item.answer} ${item.controlId ?? ""}`.toLowerCase().includes(q);
  });

  const visible = expanded ? filtered : filtered.slice(0, 6);

  return (
    <section className="rounded-3xl border border-cyan-400/20 bg-[#050b1a]/90 p-5 shadow-[0_0_40px_rgba(34,211,238,0.10)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">
            Submitted questionnaire
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">Vendor answers</h3>
          <p className="mt-1 text-sm text-slate-400">
            Compact answer review. Expand only when needed.
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
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Visible now</p>
          <p className="mt-2 text-2xl font-semibold text-white">{visible.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mode</p>
          <p className="mt-2 text-lg font-semibold text-white">{expanded ? "Expanded" : "Compact"}</p>
        </div>
      </div>

      {expanded ? (
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
          placeholder="Search answers..."
        />
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
        {visible.length ? visible.map((item, index) => (
          <details key={`${item.id}-${index}`} className="border-b border-white/10 last:border-b-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-bold uppercase ${answerTone(item.answer)}`}>
                    {item.answer.length > 24 ? `${item.answer.slice(0, 24)}...` : item.answer}
                  </span>
                  {item.controlId ? (
                    <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-slate-300">
                      {item.controlId}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-white">{item.question}</p>
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
            No submitted answers were found.
          </div>
        )}
      </div>
    </section>
  );
}



