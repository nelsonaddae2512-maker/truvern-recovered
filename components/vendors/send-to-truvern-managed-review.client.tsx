"use client";

import { MouseEvent, useState } from "react";

const TRUVERN_REVIEW_TEMPLATE_NAME =
  "Truvern NIST 800-53 Governance Review";

type TruvernReviewTemplate = {
  id: number;
  name: string;
  description?: string | null;
  standard?: string | null;
  category?: string | null;
  version?: string | null;
  source?: string | null;
  isSystem?: boolean;
  questionCount: number;
};

type CanonicalFrameworkOption = {
  slug: string;
  name: string;
  version: string;
  questionCount: number;
};

type Props = {
  vendorId: number;
  availableCredits?: number;
  reservedCredits?: number;
  consumedCredits?: number;
  templates?: TruvernReviewTemplate[];
  canonicalFramework?: CanonicalFrameworkOption | null;
};

export default function SendToTruvernManagedReview({
  vendorId,
  availableCredits = 0,
  reservedCredits = 0,
  consumedCredits = 0,
  templates = [],
  canonicalFramework = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedAcknowledgement, setAcceptedAcknowledgement] =
    useState(false);
  const [selectedQuestionnaireKey, setSelectedQuestionnaireKey] =
    useState("");

  const canonicalTemplate =
    templates.find(
      (template) =>
        template.name === TRUVERN_REVIEW_TEMPLATE_NAME,
    ) ?? null;

  const questionnaireOptions = [
    ...templates.map((template) => ({
      key: `template:${template.id}`,
      kind: "template" as const,
      templateId: template.id,
      frameworkSlug: null,
      name: template.name,
      version: template.version ?? null,
      standard: template.standard ?? null,
      questionCount: template.questionCount,
      isCanonicalTemplate:
        template.name === TRUVERN_REVIEW_TEMPLATE_NAME,
    })),
    ...(canonicalFramework
      ? [
          {
            key: `framework:${canonicalFramework.slug}`,
            kind: "framework" as const,
            templateId: null,
            frameworkSlug: canonicalFramework.slug,
            name: canonicalFramework.name,
            version: canonicalFramework.version,
            standard: "NIST SP 800-53",
            questionCount: canonicalFramework.questionCount,
            isCanonicalTemplate: false,
          },
        ]
      : []),
  ];

  const selectedQuestionnaire =
    questionnaireOptions.find(
      (option) =>
        option.key === selectedQuestionnaireKey,
    ) ?? null;

  const requiredCredits = 1;
  const available = Math.max(
    0,
    Number(availableCredits || 0),
  );
  const reserved = Math.max(
    0,
    Number(reservedCredits || 0),
  );
  const consumed = Math.max(
    0,
    Number(consumedCredits || 0),
  );
  const shortfall = Math.max(
    0,
    requiredCredits - available,
  );
  const needsCredits = shortfall > 0;

  function stopEvent(
    event: MouseEvent<HTMLElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
  }

  function openModal(
    event: MouseEvent<HTMLButtonElement>,
  ) {
    stopEvent(event);
    setError(null);
    setAcceptedAcknowledgement(false);
    setSelectedQuestionnaireKey(
      canonicalTemplate
        ? `template:${canonicalTemplate.id}`
        : questionnaireOptions[0]?.key ?? "",
    );
    setOpen(true);
  }

  function closeModal(
    event: MouseEvent<HTMLButtonElement>,
  ) {
    stopEvent(event);

    if (!submitting) {
      setOpen(false);
    }
  }

  async function submit(
    event: MouseEvent<HTMLButtonElement>,
  ) {
    stopEvent(event);

    if (
      submitting ||
      !selectedQuestionnaire ||
      !acceptedAcknowledgement
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        "/api/review-desk/assignments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vendorId,
            mode: "truvern",
            acceptedAcknowledgement,
            questionnaireKind:
              selectedQuestionnaire.kind,
            ...(selectedQuestionnaire.kind === "template"
              ? {
                  templateId:
                    selectedQuestionnaire.templateId,
                }
              : {
                  frameworkSlug:
                    selectedQuestionnaire.frameworkSlug,
                }),
          }),
        },
      );

      const data =
        await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Unable to start Truvern Review. Please try again.",
        );
      }

      window.location.assign(
        data.redirectUrl ||
          `/vendors/${vendorId}#vendor-profile`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
      >
        Start Truvern Review
      </button>

      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-to-truvern-title"
            onClick={(event) =>
              event.stopPropagation()
            }
            className="w-full max-w-3xl rounded-[1.75rem] border border-cyan-400/20 bg-[#020617] p-5 shadow-2xl shadow-cyan-500/20"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
                  Confirm Truvern Review
                </div>

                <h3
                  id="send-to-truvern-title"
                  className="mt-2 text-2xl font-black tracking-tight text-white"
                >
                  Request Truvern Review
                </h3>

                <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300">
                  Truvern manages questionnaire delivery,
                  evidence review, findings, remediation,
                  attestations, and final governance release.
                </p>
              </div>

              <div className="hidden shrink-0 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 sm:block">
                1 credit
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.35fr_1fr]">
              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Truvern questionnaire
                </div>

                {questionnaireOptions.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {questionnaireOptions.map((option) => {
                      const selected =
                        option.key === selectedQuestionnaireKey;

                      return (
                        <label
                          key={option.key}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                            selected
                              ? "border-cyan-400/40 bg-cyan-500/10"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="truvern-review-questionnaire"
                            value={option.key}
                            checked={selected}
                            onChange={() =>
                              setSelectedQuestionnaireKey(
                                option.key,
                              )
                            }
                            className="mt-1 h-4 w-4 shrink-0 border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400"
                          />

                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-3">
                              <span className="font-semibold text-white">
                                {option.name}
                              </span>

                              {option.isCanonicalTemplate ? (
                                <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                                  Truvern
                                </span>
                              ) : null}
                            </span>

                            <span className="mt-1 block text-xs text-slate-400">
                              {option.questionCount} questions
                              {option.version
                                ? ` · Version ${option.version}`
                                : ""}
                              {option.standard
                                ? ` · ${option.standard}`
                                : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-100">
                    No eligible questionnaire is currently
                    available for this Truvern Review.
                  </div>
                )}
              </section>

              <section
                className={`rounded-2xl border p-4 ${
                  needsCredits
                    ? "border-amber-400/30 bg-amber-500/10"
                    : "border-emerald-400/20 bg-emerald-500/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                    Review funding
                  </div>

                  <div
                    className={`text-xs font-semibold ${
                      needsCredits
                        ? "text-amber-200"
                        : "text-emerald-200"
                    }`}
                  >
                    {needsCredits
                      ? "Credit required"
                      : "Ready"}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      Required
                    </div>
                    <div className="mt-1 text-xl font-black text-white">
                      {requiredCredits}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      Available
                    </div>
                    <div className="mt-1 text-xl font-black text-white">
                      {available}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      Shortfall
                    </div>
                    <div className="mt-1 text-xl font-black text-white">
                      {shortfall}
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-center text-[10px] text-slate-400">
                  Reserved {reserved} · Consumed {consumed}
                </div>

                {needsCredits ? (
                  <a
                    href="/billing/credits"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Purchase credits
                  </a>
                ) : null}
              </section>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-slate-300">
              <span className="font-semibold text-white">
                Review terms.
              </span>{" "}
              Truvern findings are point-in-time governance
              evaluations, not certifications, warranties, legal
              determinations, or regulatory attestations. Final
              vendor approval and risk acceptance remain with
              your organization. Cancellation is restricted once
              questionnaire delivery or Truvern work begins, and
              credits may still be charged after work starts.
            </div>

            {error ? (
              <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">
                {needsCredits
                  ? "This Truvern Review requires 1 available credit before it can start. Purchase credits and try again."
                  : error}
              </div>
            ) : null}

            <label className="mt-3 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={acceptedAcknowledgement}
                onChange={(event) =>
                  setAcceptedAcknowledgement(
                    event.target.checked,
                  )
                }
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400"
              />

              <span className="leading-5">
                I acknowledge the Truvern Review terms and
                authorize Truvern to launch the selected
                questionnaire, coordinate the vendor review,
                and apply the applicable credit terms.
              </span>
            </label>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[10px] text-slate-500">
                Server-side entitlement and credit validation
                remains authoritative.
              </div>

              <div className="flex gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={submit}
                  disabled={
                    submitting ||
                    !acceptedAcknowledgement ||
                    !selectedQuestionnaire
                  }
                  className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                >
                  {submitting
                    ? "Sending..."
                    : "Request Truvern Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}