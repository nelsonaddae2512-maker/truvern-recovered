"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import EvidenceUpload from "./evidence-upload.client";

type QuestionCardProps = {
  assessmentId: number;
  response: {
    id: number;
    questionId: number;
    answer: unknown;
    vendorNotes: string | null;
    evidence: unknown;
    question: {
      prompt: string;
      helpText: string | null;
      evidencePrompt: string | null;
      requiresEvidence: boolean;
      requiresAttestation: boolean;
      weight: number;
      control: {
        controlId: string;
        family: string | null;
        title: string;
      };
    };
  };
};

function initialAnswer(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (value && typeof value === "object" && "value" in value) {
    const nested = (value as { value?: unknown }).value;
    return typeof nested === "string" ? nested : "";
  }
  return "";
}

function initialEvidence(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "description" in value) {
    const nested = (value as { description?: unknown }).description;
    return typeof nested === "string" ? nested : "";
  }
  return "";
}

export default function VendorAssessmentQuestionCard({
  assessmentId,
  response,
}: QuestionCardProps) {
  const [answer, setAnswer] = useState(initialAnswer(response.answer));
  const [vendorNotes, setVendorNotes] = useState(response.vendorNotes ?? "");
  const [evidence, setEvidence] = useState(initialEvidence(response.evidence));

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const initialMount = useRef(true);

  async function persist() {
    setSaved(false);
    setError("");

    const result = await fetch(
      `/api/vendor-assessments/${assessmentId}/responses`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          responseId: response.id,
          answer,
          vendorNotes,
          evidence: evidence
            ? {
                description: evidence,
                submittedAt: new Date().toISOString(),
              }
            : null,
        }),
      }
    );

    const json = await result.json().catch(() => ({}));

    if (!result.ok || !json.ok) {
      setError(json.error ?? "Could not autosave response.");
      return;
    }

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2000);
  }

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      startTransition(async () => {
        await persist();
      });
    }, 700);

    return () => clearTimeout(timeout);
  }, [answer, vendorNotes, evidence]);

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              {response.question.control.controlId}
            </span>

            {response.question.control.family ? (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
                {response.question.control.family}
              </span>
            ) : null}

            {response.question.requiresEvidence ? (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                Evidence required
              </span>
            ) : null}

            {response.question.requiresAttestation ? (
              <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs text-violet-100">
                Attestation may be required
              </span>
            ) : null}
          </div>

          <h3 className="mt-4 text-base font-semibold leading-7 text-white">
            {response.question.prompt}
          </h3>

          {response.question.helpText ? (
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {response.question.helpText}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
          Weight {response.question.weight}
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Answer
          </span>

          <select
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Select answer</option>
            <option value="yes">Yes / implemented</option>
            <option value="partial">Partial / in progress</option>
            <option value="no">No / not implemented</option>
            <option value="not_applicable">Not applicable</option>
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Vendor notes
          </span>

          <textarea
            value={vendorNotes}
            onChange={(event) => setVendorNotes(event.target.value)}
            rows={3}
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
            placeholder="Explain implementation, exceptions, compensating controls, or planned remediation..."
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Evidence description
          </span>

          <textarea
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            rows={2}
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
            placeholder={
              response.question.evidencePrompt ??
              "Describe evidence, report, certification, or document available for review..."
            }
          />
        </label>

        <EvidenceUpload
          assessmentId={assessmentId}
          responseId={response.id}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {pending ? (
          <span className="text-sm text-cyan-200">
            Autosaving...
          </span>
        ) : null}

        {saved ? (
          <span className="text-sm text-emerald-300">
            Saved automatically
          </span>
        ) : null}

        {error ? (
          <span className="text-sm text-rose-300">
            {error}
          </span>
        ) : null}
      </div>
    </article>
  );
}
