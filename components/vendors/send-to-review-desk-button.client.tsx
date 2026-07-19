"use client";

import { useState } from "react";

type ReviewDeskResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  redirectUrl?: string;
  fundingUrl?: string;
  requiredCredits?: number;
  availableCredits?: number;
  reservedCredits?: number;
  consumedCredits?: number;
  effectiveCredits?: number;
  eligiblePlan?: string | null;
};

export default function SendToReviewDeskButton({
  vendorId,
}: {
  vendorId: number;
}) {
  const [busy, setBusy] = useState(false);
  const [fundingError, setFundingError] =
    useState<ReviewDeskResponse | null>(null);

  async function send() {
    try {
      setBusy(true);
      setFundingError(null);

      const res = await fetch("/api/review-desk/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId }),
      });

      const data =
        (await res.json().catch(() => null)) as ReviewDeskResponse | null;

      if (!res.ok) {
        if (
          res.status === 402 ||
          data?.code === "INSUFFICIENT_CREDITS" ||
          data?.code === "TRUVERN_ACCESS_REQUIRED"
        ) {
          setFundingError(data || {});
          return;
        }

        throw new Error(data?.error || "Failed to send to governance ops");
      }

      window.location.href = data?.redirectUrl || "/review-desk";
    } catch (err) {
      console.error(err);
      alert("Failed to send to governance ops");
    } finally {
      setBusy(false);
    }
  }

  if (fundingError) {
    const fundingUrl =
      fundingError.fundingUrl || "/billing/credits";

    return (
      <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-50">
        <p className="font-semibold text-white">
          Truvern Expert Review Access Required
        </p>

        <p className="mt-2 text-amber-100/90">
          Routing assessments into Truvern Ops requires available Truvern credits or an eligible paid plan.
        </p>

        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
          <Stat
            label="Available"
            value={fundingError.availableCredits ?? 0}
          />
          <Stat
            label="Reserved"
            value={fundingError.reservedCredits ?? 0}
          />
          <Stat
            label="Consumed"
            value={fundingError.consumedCredits ?? 0}
          />
          <Stat
            label="Required"
            value={fundingError.requiredCredits ?? 1}
          />
        </div>

        {fundingError.eligiblePlan ? (
          <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-100">
            Eligible plan detected:
            <span className="ml-2 font-semibold">
              {fundingError.eligiblePlan}
            </span>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`${fundingUrl}?returnTo=/review-desk`}
            className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 hover:bg-cyan-400/20"
          >
            Purchase credits
          </a>

          <a
            href="/billing/plans"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-white/10"
          >
            Compare plans
          </a>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={busy}
      className="rounded-2xl border border-white/10 px-5 py-3 text-center font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Sending…" : "Send to Governance Ops"}
    </button>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <span className="block text-amber-100/70">{label}</span>
      <strong className="text-white">{value}</strong>
    </div>
  );
}



