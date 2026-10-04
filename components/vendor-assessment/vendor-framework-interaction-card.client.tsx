"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import EvidenceUpload from "./evidence-upload.client";

type ApplicabilityState =
  | "APPLICABLE"
  | "NOT_APPLICABLE"
  | "UNRESOLVED";

type ProjectionMetadata = {
  profileId?: unknown;
  profileVersion?: unknown;
  interactionId?: unknown;
  componentId?: unknown;
  applicability?: unknown;
  notApplicableJustification?: unknown;
};

export type VendorFrameworkResponse = {
  id: number;
  questionId: number;
  answer: unknown;
  vendorNotes: string | null;
  evidence: unknown;
  metadata: unknown;
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

export type VendorInteractionComponent = {
  componentId: string;
  order: number;
  canonicalQuestionId: number;
  canonicalControlId: string;
  family: string;
  label: string;
  required: boolean;
};

export type VendorInteractionDefinition = {
  interactionId: string;
  order: number;
  family: string;
  title: string;
  prompt: string;
  evidenceExpectation: string;
  components: VendorInteractionComponent[];
};

type Props = {
  assessmentId: number;
  token: string;
  profileId: string;
  profileVersion: string;
  interaction: VendorInteractionDefinition;
  responsesByQuestionId: Record<number, VendorFrameworkResponse>;
  onComponentSaved: (
    responseId: number,
    complete: boolean,
  ) => void;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function initialAnswer(value: unknown) {
  if (typeof value === "string") return value;

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  if (
    value &&
    typeof value === "object" &&
    "value" in value
  ) {
    const nested =
      (value as { value?: unknown }).value;

    return typeof nested === "string"
      ? nested
      : "";
  }

  return "";
}

function initialEvidence(value: unknown) {
  if (typeof value === "string") return value;

  if (
    value &&
    typeof value === "object" &&
    "description" in value
  ) {
    const nested =
      (value as { description?: unknown })
        .description;

    return typeof nested === "string"
      ? nested
      : "";
  }

  return "";
}

function readProjectionMetadata(
  metadata: unknown,
): ProjectionMetadata | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const raw =
    metadata.truvernQuestionnaireProjection;

  return isRecord(raw)
    ? raw
    : null;
}

function initialApplicability(
  response: VendorFrameworkResponse,
): ApplicabilityState {
  const projection =
    readProjectionMetadata(response.metadata);

  const state =
    projection?.applicability;

  if (
    state === "APPLICABLE" ||
    state === "NOT_APPLICABLE" ||
    state === "UNRESOLVED"
  ) {
    return state;
  }

  /*
   * Legacy canonical responses had no applicability metadata.
   * Treat them as applicable so their historical answer-required
   * semantics remain unchanged.
   */
  return "APPLICABLE";
}

function initialJustification(
  response: VendorFrameworkResponse,
) {
  const projection =
    readProjectionMetadata(response.metadata);

  const value =
    projection?.notApplicableJustification;

  return typeof value === "string"
    ? value
    : "";
}

function hasAnswer(value: string) {
  return value.trim().length > 0;
}

function componentComplete(
  applicability: ApplicabilityState,
  answer: string,
  justification: string,
) {
  if (applicability === "UNRESOLVED") {
    return false;
  }

  if (applicability === "NOT_APPLICABLE") {
    return justification.trim().length > 0;
  }

  return hasAnswer(answer);
}

function ComponentEditor({
  assessmentId,
  token,
  profileId,
  profileVersion,
  interaction,
  component,
  response,
  onSaved,
}: {
  assessmentId: number;
  token: string;
  profileId: string;
  profileVersion: string;
  interaction: VendorInteractionDefinition;
  component: VendorInteractionComponent;
  response: VendorFrameworkResponse;
  onSaved: (
    responseId: number,
    complete: boolean,
  ) => void;
}) {
  const [answer, setAnswer] =
    useState(initialAnswer(response.answer));

  const [vendorNotes, setVendorNotes] =
    useState(response.vendorNotes ?? "");

  const [evidence, setEvidence] =
    useState(initialEvidence(response.evidence));

  const [applicability, setApplicability] =
    useState<ApplicabilityState>(
      initialApplicability(response),
    );

  const [
    notApplicableJustification,
    setNotApplicableJustification,
  ] =
    useState(
      initialJustification(response),
    );

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState("");

  const [pending, startTransition] =
    useTransition();

  const initialMount =
    useRef(true);

  async function persist() {
    setSaved(false);
    setError("");

    if (
      applicability === "NOT_APPLICABLE" &&
      !notApplicableJustification.trim()
    ) {
      setError(
        "Explain why this control is not applicable before continuing.",
      );

      onSaved(response.id, false);
      return;
    }

    const result =
      await fetch(
        `/api/vendor-framework-assessment/${encodeURIComponent(token)}/responses`,
        {
          method: "PATCH",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            responseId: response.id,

            /*
             * N/A is never persisted as a scored answer.
             * The B1 server contract clears the canonical answer
             * for NOT_APPLICABLE.
             */
            answer:
              applicability ===
              "NOT_APPLICABLE"
                ? null
                : answer,

            vendorNotes,

            evidence: evidence
              ? {
                  description: evidence,
                  submittedAt:
                    new Date().toISOString(),
                }
              : null,

            applicability: {
              profileId,
              profileVersion,
              interactionId:
                interaction.interactionId,
              componentId:
                component.componentId,
              applicability,
              notApplicableJustification:
                applicability ===
                "NOT_APPLICABLE"
                  ? notApplicableJustification
                  : null,
            },
          }),
        },
      );

    const json =
      await result
        .json()
        .catch(() => ({}));

    if (
      !result.ok ||
      !json.ok
    ) {
      setError(
        json.error ??
          "Could not autosave response.",
      );
      return;
    }

    const complete =
      componentComplete(
        applicability,
        answer,
        notApplicableJustification,
      );

    onSaved(
      response.id,
      complete,
    );

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

    const timeout =
      setTimeout(() => {
        startTransition(async () => {
          await persist();
        });
      }, 700);

    return () =>
      clearTimeout(timeout);
  }, [
    answer,
    vendorNotes,
    evidence,
    applicability,
    notApplicableJustification,
  ]);

  const isNotApplicable =
    applicability ===
    "NOT_APPLICABLE";

  const isUnresolved =
    applicability ===
    "UNRESOLVED";

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              {component.canonicalControlId}
            </span>

            {component.family ? (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
                {component.family}
              </span>
            ) : null}

            {response.question.requiresEvidence ? (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                Evidence required
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 text-sm font-semibold text-white">
            {component.label}
          </h3>

          {interaction.components.length > 1 ? (
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {response.question.prompt}
            </p>
          ) : null}

          {response.question.helpText ? (
            <details className="group mt-3 rounded-2xl border border-white/10 bg-black/20">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-cyan-100">
                NIST guidance
              </summary>

              <p className="border-t border-white/10 px-4 py-4 text-sm leading-6 text-slate-400">
                {response.question.helpText}
              </p>
            </details>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
          Component {component.order}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Applicability
          </span>

          <select
            value={applicability}
            onChange={(event) =>
              setApplicability(
                event.target.value as
                  ApplicabilityState,
              )
            }
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="APPLICABLE">
              Applicable
            </option>

            <option value="NOT_APPLICABLE">
              Not applicable
            </option>

            <option value="UNRESOLVED">
              Unsure — needs review
            </option>
          </select>
        </label>

        {isNotApplicable ? (
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Not-applicable justification
            </span>

            <textarea
              value={
                notApplicableJustification
              }
              onChange={(event) =>
                setNotApplicableJustification(
                  event.target.value,
                )
              }
              rows={3}
              required
              className="rounded-2xl border border-amber-300/20 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
              placeholder="Explain why this control does not apply to the services, systems, data, facilities, or delivery model in scope."
            />
          </label>
        ) : null}

        {!isNotApplicable ? (
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Answer
            </span>

            <select
              value={answer}
              onChange={(event) =>
                setAnswer(
                  event.target.value,
                )
              }
              disabled={isUnresolved}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none disabled:opacity-50"
            >
              <option value="">
                Select answer
              </option>

              <option value="yes">
                Yes / implemented
              </option>

              <option value="partial">
                Partial / in progress
              </option>

              <option value="no">
                No / not implemented
              </option>
            </select>
          </label>
        ) : null}

        {isUnresolved ? (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
            This component remains unresolved and
            will block questionnaire submission
            until its applicability is resolved.
          </div>
        ) : null}

        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Vendor notes
          </span>

          <textarea
            value={vendorNotes}
            onChange={(event) =>
              setVendorNotes(
                event.target.value,
              )
            }
            rows={3}
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
            placeholder="Explain implementation, exceptions, compensating controls, or planned remediation..."
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Evidence description
          </span>

          <textarea
            value={evidence}
            onChange={(event) =>
              setEvidence(
                event.target.value,
              )
            }
            rows={2}
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
            placeholder={
              response.question
                .evidencePrompt ??
              "Describe evidence, report, certification, or document available for review..."
            }
          />
        </label>

        <EvidenceUpload
          assessmentId={assessmentId}
          responseId={response.id}
          vendorToken={token}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
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
    </section>
  );
}

export default function VendorFrameworkInteractionCard({
  assessmentId,
  token,
  profileId,
  profileVersion,
  interaction,
  responsesByQuestionId,
  onComponentSaved,
}: Props) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              {interaction.family}
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
              Interaction {interaction.order} of 213
            </span>

            {interaction.components.length > 1 ? (
              <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs text-violet-100">
                {interaction.components.length} control components
              </span>
            ) : null}
          </div>

          <h2 className="mt-4 text-lg font-semibold text-white">
            {interaction.title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            {interaction.prompt}
          </p>

          {interaction.evidenceExpectation ? (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Evidence: {interaction.evidenceExpectation}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {interaction.components.map(
          (component) => {
            const response =
              responsesByQuestionId[
                component.canonicalQuestionId
              ];

            if (!response) {
              return (
                <div
                  key={component.componentId}
                  className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100"
                >
                  Canonical response missing for
                  question{" "}
                  {component.canonicalQuestionId}.
                  Submission remains fail-closed.
                </div>
              );
            }

            return (
              <ComponentEditor
                key={
                  component.componentId
                }
                assessmentId={
                  assessmentId
                }
                token={token}
                profileId={profileId}
                profileVersion={
                  profileVersion
                }
                interaction={
                  interaction
                }
                component={
                  component
                }
                response={response}
                onSaved={
                  onComponentSaved
                }
              />
            );
          },
        )}
      </div>
    </article>
  );
}