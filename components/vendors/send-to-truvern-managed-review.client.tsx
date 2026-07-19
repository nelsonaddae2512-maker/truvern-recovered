"use client";

import { MouseEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  vendorId: number;
  availableCredits?: number;
  reservedCredits?: number;
  consumedCredits?: number;
};

export default function SendToTruvernManagedReview({
  vendorId,
  availableCredits = 0,
  reservedCredits = 0,
  consumedCredits = 0,
}: Props) {
  const hasAvailableCredit = Number(availableCredits || 0) >= 1;
  const needsCredits = !hasAvailableCredit;

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedAcknowledgement, setAcceptedAcknowledgement] = useState(false);

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
                I acknowledge that this starts a Truvern Review end-to-end workflow. Truvern will launch the locked NIST 800-53 questionnaire, begin vendor coordination, and reserve review capacity. Cancellation is restricted once questionnaire delivery or vendor work begins. This starts a Truvern-managed governance
                review, may reserve and consume Truvern credits, and does not
                constitute a certification, legal guarantee, or regulatory
                attestation.
              </span>
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting || !acceptedAcknowledgement}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submit}
                disabled={submitting || !acceptedAcknowledgement}
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



















