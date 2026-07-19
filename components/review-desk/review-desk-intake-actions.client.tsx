"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type CreditBalance = {
  availableCredits: number;
  reservedCredits: number;
  consumedCredits: number;
  effectiveCredits: number;
};

type AnalystOption = {
  userId: string;
  name: string;
  email?: string | null;
};

type Props = {
  vendorId: number;
  creditBalance?: CreditBalance;
  analysts?: AnalystOption[];
};

type Mode = "internal" | "truvern";

const TRUVERN_REVIEW_COST = 1;

type AssignmentResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  redirectUrl?: string;
  requiredCredits?: number;
  availableCredits?: number;
  reservedCredits?: number;
  effectiveCredits?: number;
  fundingUrl?: string;
};

export default function ReviewDeskSubmissionActions({
  vendorId,
  creditBalance,
  analysts = [],
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<Mode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creditError, setCreditError] = useState<AssignmentResponse | null>(
    null,
  );
  const [selectedAnalystId, setSelectedAnalystId] = useState("");
  const [acceptedAcknowledgement, setAcceptedAcknowledgement] = useState(false);
  const [, startTransition] = useTransition();

  async function createAssignment(mode: Mode) {
    setBusy(mode);
    setMessage(null);
    setCreditError(null);

    try {
      const res = await fetch("/api/review-desk/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendorId,
          mode,
          reviewerUserId: mode === "internal" ? selectedAnalystId : "",
          assignedReviewerName:
            mode === "internal"
              ? analysts.find((analyst) => analyst.userId === selectedAnalystId)?.name || ""
              : "",
        }),
      });

      const data = (await res.json().catch(() => ({}))) as AssignmentResponse;

      if (!res.ok || !data.ok) {
        if (res.status === 402 || data.code === "INSUFFICIENT_CREDITS") {
          setCreditError(data);
          return;
        }

        throw new Error(data.error || "Failed to create review assignment.");
      }

      setMessage(
        mode === "truvern"
          ? "Truvern expert review requested."
          : "Internal review started.",
      );

      startTransition(() => {
        router.push(data.redirectUrl || "/review-desk");
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 shadow-2xl shadow-black/20">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
        Governance Ops Submission
      </p>

      <h3 className="mt-3 text-xl font-semibold text-white">
        Start a governance review
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        Choose a Self-Managed Review workflow or reserve Truvern credits for an
        expert governance review.
      </p>

      {creditBalance ? (
        <div className="mt-5 grid gap-2 text-xs text-slate-200 sm:grid-cols-4">
          <CreditStat label="Available" value={creditBalance.availableCredits} />
          <CreditStat label="Reserved" value={creditBalance.reservedCredits} />
          <CreditStat label="Consumed" value={creditBalance.consumedCredits} />
          <CreditStat
            label="Effective"
            value={creditBalance.effectiveCredits}
            accent
          />
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
          {message}
        </div>
      ) : null}

            {creditError ? (
        <div className="mt-4 overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
          <div className="border-b border-amber-300/20 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">
                  Truvern Expert Review
                </p>

                <h4 className="mt-2 text-lg font-semibold text-white">
                  Governance review capacity required
                </h4>
              </div>

              <div className="rounded-full border border-amber-300/20 bg-black/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                Credits required
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            <p className="max-w-2xl text-sm leading-7 text-amber-50/90">
              Truvern expert reviews are delivered as an operational governance service.
              Each review reserves Truvern review credits before governance work begins.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <CreditStat
                label="Available"
                value={creditError.availableCredits ?? 0}
              />

              <CreditStat
                label="Reserved"
                value={creditError.reservedCredits ?? 0}
              />

              <CreditStat
                label="Effective"
                value={creditError.effectiveCredits ?? 0}
              />

              <CreditStat
                label="Required"
                value={creditError.requiredCredits ?? TRUVERN_REVIEW_COST}
                accent
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">
                  Governance review reservation
                </span>

                <span className="font-semibold text-white">
                  {creditError.requiredCredits ?? TRUVERN_REVIEW_COST} credit
                  {(creditError.requiredCredits ?? TRUVERN_REVIEW_COST) === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Credits are reserved when routing to Truvern Ops
                </span>

                <span>
                  Consumed on governance release
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={`${creditError.fundingUrl || "/billing/credits"}?returnTo=/review-desk`}
                className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-400/20"
              >
                Purchase Truvern credits
              </a>

              <button
                type="button"
                onClick={() => setCreditError(null)}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {analysts.length ? (
        <div className="mt-5">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Internal analyst
          </label>

          <select
            value={selectedAnalystId}
            onChange={(event) => setSelectedAnalystId(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
          >
            <option value="">Leave Truvern Review Team</option>
            {analysts.map((analyst) => (
              <option key={analyst.userId} value={analyst.userId}>
                {analyst.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {analysts.length ? (
        <div className="mt-5">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Truvern expert reviewer
          </label>

          <select
            value={selectedAnalystId}
            onChange={(event) => setSelectedAnalystId(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
          >
            <option value="">Leave Truvern Review Team</option>
            {analysts.map((analyst) => (
              <option key={analyst.userId} value={analyst.userId}>
                {analyst.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

            <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Truvern Review Reservation
            </p>

            <p className="mt-2 text-sm text-slate-200">
              Routing this assessment to Truvern Ops will reserve
              <span className="font-semibold text-white">
                {" "}1 Truvern credit
              </span>
              {" "}from your governance balance.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-300/20 bg-black/20 px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.18em] text-cyan-200">
              Spend
            </div>

            <div className="mt-1 text-lg font-semibold text-white">
              -1 Credit
            </div>
          </div>
        </div>
      </div>

      <label className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={acceptedAcknowledgement}
          onChange={(event) => setAcceptedAcknowledgement(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400"
        />

        <span className="leading-6">
          I acknowledge that Truvern governance outcomes are operational
          governance assessments and not legal guarantees,
          certifications, warranties, or regulatory attestations.
          Final governance responsibility remains with my organization.
        </span>
      </label>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => createAssignment("internal")}
          disabled={busy !== null}
          className="rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "internal" ? "Starting…" : "Start Self-Managed Review"}
        </button>

        <button
          type="button"
          onClick={() => createAssignment("truvern")}
          disabled={busy !== null || !acceptedAcknowledgement}
          className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "truvern"
  ? "Requesting…"
  : "Route to Truvern Ops"}
        </button>
      </div>
    </div>
  );
}

function CreditStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2"
          : "rounded-xl border border-white/10 bg-black/20 px-3 py-2"
      }
    >
      <span className={accent ? "block text-cyan-200" : "block text-slate-400"}>
        {label}
      </span>
      <strong className="text-white">{value}</strong>
    </div>
  );
}

















