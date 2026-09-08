"use client";

import { useMemo, useState } from "react";
import VendorAssessmentQuestionCard from "./question-card";

type AssessmentResponse = {
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

type Props = {
  assessmentId: number;
  initialStatus: string;
  responses: AssessmentResponse[];
  token: string;
};

function hasAnswer(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

export default function VendorFrameworkAssessmentWorkspace({
  assessmentId,
  initialStatus,
  responses,
  token,
}: Props) {
  const initialAnsweredIds =
    useMemo(
      () =>
        responses
          .filter((response) => hasAnswer(response.answer))
          .map((response) => response.id),
      [responses],
    );

  const [answeredIds, setAnsweredIds] =
    useState<Set<number>>(
      () => new Set(initialAnsweredIds),
    );

  const [status, setStatus] =
    useState(initialStatus);

  function handleSaved(
    responseId: number,
    answered: boolean,
  ) {
    setAnsweredIds((current) => {
      const next =
        new Set(current);

      if (answered) {
        next.add(responseId);
      } else {
        next.delete(responseId);
      }

      return next;
    });

    setStatus((current) =>
      current === "DRAFT"
        ? "VENDOR_IN_PROGRESS"
        : current,
    );
  }

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Status
            </div>

            <div className="mt-1 font-semibold">
              {status}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Progress
            </div>

            <div className="mt-1 font-semibold">
              {answeredIds.size} / {responses.length}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {responses.map((response) => (
          <VendorAssessmentQuestionCard
            key={response.id}
            assessmentId={assessmentId}
            response={response}
            vendorToken={token}
            onSaved={handleSaved}
          />
        ))}
      </section>
    </>
  );
}