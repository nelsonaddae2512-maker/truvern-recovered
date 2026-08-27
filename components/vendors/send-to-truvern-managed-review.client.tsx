"use client";

import { MouseEvent, useState } from "react";
import { useRouter } from "next/navigation";

type TruvernReviewTemplate = {
  id: number;
  name: string;
  description?: string | null;
  standard?: string | null;
  category?: string | null;
  version?: string | null;
  source?: string | null;
  isSystem?: boolean;
};

type Props = {
  vendorId: number;
  availableCredits?: number;
  reservedCredits?: number;
  consumedCredits?: number;
  templates?: TruvernReviewTemplate[];
};

export default function SendToTruvernManagedReview({
  vendorId,
  availableCredits = 0,
  reservedCredits = 0,
  consumedCredits = 0,
  templates = [],
}: Props) {
  const hasAvailableCredit = Number(availableCredits || 0) >= 1;
  const needsCredits = !hasAvailableCredit;

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedAcknowledgement, setAcceptedAcknowledgement] = useState(false);

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    templates[0]?.id ?? null,
  );
    Boolean(error) &&
    (error?.toLowerCase().includes("credit") ||
      error?.toLowerCase().includes("insufficient") ||
      error?.toLowerCase().includes("review assignment"));

  function stopEvent(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function openModal(event: MouseEvent<HTMLButtonElement>) {
    stopEvent(event);
    setError(null);
    setOpen(true);
  }

  function closeModal(event: MouseEvent<HTMLButtonElement>) {
    stopEvent(event);
    if (!submitting) setOpen(false);
  }

  async function submit(event: MouseEvent<HTMLButtonElement>) {
    stopEvent(event);

    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/review-desk/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendorId,
          templateId: selectedTemplateId,
          mode: "truvern",
          acceptedAcknowledgement,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Unable to start Truvern Review. Please try again.",
        );
      }

      window.location.assign(data.redirectUrl || `/vendors/${vendorId}#vendor-profile`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
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
          onClick={(event) => event.stopPropagation()}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-to-truvern-title"
            onClick={(event) => event.stopPropagation()}
            className="mx-auto my-6 w-full max-w-xl rounded-[2rem] border border-cyan-400/20 bg-[#020617] p-6 shadow-2xl shadow-cyan-500/20"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Confirm Truvern Review
            </div>

            <h3
              id="send-to-truvern-title"
              className="mt-4 text-2xl font-black tracking-tight text-white"
            >
              Request Truvern Review
            </h3>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              Flow: Request → Truvern Ops accepts → Vendor questionnaire → Review → Findings/remediation → Release. Credits may still be charged once questionnaire delivery or vendor work begins, even if the request is later cancelled or revoked. Truvern will manage the vendor review lifecycle: questionnaire
              distribution, evidence collection, expert review, findings,
              remediation coordination, and final governance release.
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-300">
              <p>
                By continuing, you acknowledge that this action initiates a
                Truvern-managed governance review workflow and may reserve
                1 Truvern credit for your organization.
              </p>

              <p className="mt-4">
                Truvern reviews are operational governance assessments based on
                information, evidence, attestations, and materials provided
                during the review process. Governance findings, risk opinions,
                remediation guidance, and release records are point-in-time
                operational evaluations and are not certifications, guarantees,
                legal determinations, or warranties of security, compliance,
                vendor performance, or regulatory standing.
              </p>

              <p className="mt-4">
                Final vendor approval, procurement decisions, legal review,
                compliance obligations, and risk acceptance remain the
                responsibility of the customer organization.
              </p>
            </div>

            {error ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                  <div className="font-bold">
                    {needsCredits ? "Insufficient Truvern credits" : "Failed to create review assignment"}
                  </div>
                  <div className="mt-1">
                    {needsCredits
                      ? "This review requires 1 Truvern credit before it can be started."
                      : error}
                  </div>
                </div>

                {needsCredits ? (
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5 text-sm text-slate-200">
                    <div className="text-lg font-black text-white">
                      You need more Truvern credits
                    </div>
                    <p className="mt-2 leading-6 text-slate-300">
                      This Truvern Review requires 1 credit. Purchase credits to continue, then return to request the review again.
                    </p>

                    <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:grid-cols-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Required</div>
                        <div className="mt-1 text-2xl font-black text-cyan-200">1</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Available</div>
                        <div className="mt-1 text-2xl font-black text-rose-200">0</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Shortfall</div>
                        <div className="mt-1 text-2xl font-black text-amber-200">1</div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <a
                        href="/billing/credits"
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
                      >
                        Purchase Truvern Credits →
                      </a>
                      <a
                        href="/billing/plans"
                        className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                      >
                        View Credit Plans →
                      </a>
                    </div>

                    <div className="mt-3 text-center text-xs text-slate-400">
                      Secure payment powered by Stripe.
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-6">
              <div className="mb-3">
                <p className="text-sm font-semibold text-white">
                  Select assessment template
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Choose the questionnaire Truvern should launch and manage.
                  Select a Truvern template or one of your organization's custom templates.
                </p>
              </div>

              {templates.length > 0 ? (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {templates.map((template) => {
                    const selected =
                      selectedTemplateId === template.id;

                    const truvernTemplate =
                      template.isSystem === true ||
                      template.source === "SYSTEM" ||
                      template.source === "TRUVERN";

                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() =>
                          setSelectedTemplateId(template.id)
                        }
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-cyan-400/60 bg-cyan-400/10"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-white">
                              {template.name}
                            </p>

                            {template.description ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                                {template.description}
                              </p>
                            ) : null}

                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                              <span>
                                {truvernTemplate
                                  ? "Truvern Template"
                                  : "My Organization Template"}
                              </span>

                              {template.standard ? (
                                <span>• {template.standard}</span>
                              ) : null}

                              {template.version ? (
                                <span>• v{template.version}</span>
                              ) : null}
                            </div>
                          </div>

                          <span
                            aria-hidden="true"
                            className={`mt-1 h-4 w-4 shrink-0 rounded-full border ${
                              selected
                                ? "border-cyan-300 bg-cyan-300"
                                : "border-slate-500"
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  No active assessment templates are currently available.
                </div>
              )}
            </div>

            <label className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={acceptedAcknowledgement}
                onChange={(event) =>
                  setAcceptedAcknowledgement(event.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400"
              />

              <span className="leading-6">
                I acknowledge that this starts a Truvern Review end-to-end workflow. Truvern will launch the assessment template selected above, begin vendor coordination, and reserve review capacity. Cancellation is restricted once questionnaire delivery or vendor work begins. This starts a Truvern-managed governance
                review, may reserve and consume Truvern credits, and does not
                constitute a certification, legal guarantee, or regulatory
                attestation.
              </span>
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submit}
                disabled={submitting || !acceptedAcknowledgement || !selectedTemplateId}
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
              >
                {submitting ? "Sending to Truvern Ops..." : "Request Truvern Review"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}



















