import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import CreditCheckoutButton from "./credit-checkout-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const packs = [
  {
    key: "starter" as const,
    name: "Starter",
    credits: 5,
    useCase: "Small business",
    description:
      "Begin using Truvern expert capacity for important vendor reviews without hiring analysts.",
  },
  {
    key: "growth" as const,
    name: "Growth",
    credits: 20,
    useCase: "Active governance",
    description:
      "Support recurring assessments, review spikes, and operational vendor governance needs.",
    featured: true,
  },
  {
    key: "scale" as const,
    name: "Scale",
    credits: 100,
    useCase: "Enterprise throughput",
    description:
      "Fund higher-volume governance operations, continuous monitoring, and expert review capacity.",
  },
];

const capabilities = [
  "Expert vendor risk reviews",
  "Evidence validation support",
  "Governance assessment acceleration",
  "Release-ready governance summaries",
  "Board-facing governance documentation",
  "Continuous governance operations",
];

const lifecycle = [
  "Request expert review",
  "Credits are reserved",
  "Truvern performs governance review",
  "Governance is finalized",
  "Credits are consumed",
];

function safeInt(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function formatDate(value: unknown) {
  if (!value) return "Unknown";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(String(value)));
  } catch {
    return "Unknown";
  }
}

async function getCreditBalance(organizationId?: number | null) {
  if (!organizationId) {
    return {
      availableCredits: 0,
      reservedCredits: 0,
      consumedCredits: 0,
      effectiveCredits: 0,
    };
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      availableCredits: number;
      reservedCredits: number;
      consumedCredits: number;
      effectiveCredits: number;
    }>
  >(
    `
    select
      coalesce(sum("availableDelta"), 0)::int as "availableCredits",
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
      coalesce(sum("consumedDelta"), 0)::int as "consumedCredits",
      (
        coalesce(sum("availableDelta"), 0)
        + coalesce(sum("reservedDelta"), 0)
        - coalesce(sum("consumedDelta"), 0)
      )::int as "effectiveCredits"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = $1
    `,
    organizationId,
  );

  return {
    availableCredits: safeInt(rows?.[0]?.availableCredits),
    reservedCredits: safeInt(rows?.[0]?.reservedCredits),
    consumedCredits: safeInt(rows?.[0]?.consumedCredits),
    effectiveCredits: safeInt(rows?.[0]?.effectiveCredits),
  };
}

async function getLedgerActivity(
  organizationId?: number | null,
) {
  if (!organizationId) {
    return [];
  }

  return prisma.$queryRawUnsafe<
    Array<{
      id: number;
      entryType: string | null;
      fundingSource: string | null;
      note: string | null;
      availableDelta: number | null;
      reservedDelta: number | null;
      consumedDelta: number | null;
      createdAt: string | Date | null;
      status: string | null;
      metadataJson: any;
    }>
  >(
    `
    select
      id,
      "entryType"::text as "entryType",
      "fundingSource"::text as "fundingSource",
      note,
      "availableDelta",
      "reservedDelta",
      "consumedDelta",
      status::text as status,
      "metadataJson",
      "createdAt"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = $1
    order by "createdAt" desc, id desc
    limit 12
    `,
    organizationId,
  );
}

function deltaClass(value: number) {
  if (value > 0) {
    return "text-emerald-300";
  }

  if (value < 0) {
    return "text-rose-300";
  }

  return "text-slate-400";
}

function activityTitle(row: {
  entryType: string | null;
  note: string | null;
  availableDelta: number | null;
  metadataJson?: any;
}) {
  const type = String(row.entryType || "").toUpperCase();
  const credits = Math.abs(safeInt(row.availableDelta));
  const packName = row.metadataJson?.packName;

  if (type === "PURCHASE") {
    return `Purchased ${credits} Truvern credit${credits === 1 ? "" : "s"}${packName ? ` · ${packName}` : ""}`;
  }

  return row.note || "Ledger event";
}

function activitySource(row: {
  entryType: string | null;
  fundingSource: string | null;
  metadataJson?: any;
}) {
  const type = String(row.entryType || "").toUpperCase();

  if (type === "PURCHASE") {
    return "Stripe Checkout";
  }

  return row.fundingSource || "Unknown source";
}

function activityBadgeClass(entryType: string | null) {
  const type = String(entryType || "").toUpperCase();

  if (type === "PURCHASE" || type === "GRANT") {
    return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  }

  if (type === "RESERVATION") {
    return "border-sky-300/20 bg-sky-300/10 text-sky-100";
  }

  if (type === "CONSUMPTION") {
    return "border-purple-300/20 bg-purple-300/10 text-purple-100";
  }

  if (type === "REVERSAL" || type === "REFUND") {
    return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  }

  return "border-white/10 bg-white/[0.04] text-slate-200";
}

export default async function BillingCreditsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    purchase?: string;
    pack?: string;
    returnTo?: string;
  }>;
}) {
  const params = await searchParams;
  const purchase = params?.purchase;

  const rawReturnTo = String(params?.returnTo || "").trim();

  const returnTo =
    rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/review-desk";

  await auth();

  let organizationId: number | null = null;

  try {
    const org = await requireDbOrganization();
    organizationId = "id" in org ? org.id : null;
  } catch {
    organizationId = null;
  }

  const [balance, activity] = await Promise.all([
    getCreditBalance(organizationId),
    getLedgerActivity(organizationId),
  ]);

  const visibleActivity = activity.slice(0, 5);
  const hiddenActivity = activity.slice(5);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_30%)]" />

        <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full border border-teal-300/20 bg-teal-300/10 px-4 py-1 text-sm font-medium text-teal-200">
              Truvern Governance Capacity
            </p>

            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              Get Truvern Expert Help
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-300">
              Reserve expert governance reviews, accelerate vendor reviews,
              and access continuous governance operations without hiring a full
              analyst team.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#credit-packs"
                className="rounded-full bg-teal-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 hover:bg-teal-200"
              >
                View Credit Packs
              </a>

              <Link
                href="/review-desk"
                className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Go to Governance Ops
              </Link>

              <Link
                href="/billing/plans"
                className="rounded-full border border-teal-300/25 bg-teal-300/10 px-5 py-3 text-sm font-semibold text-teal-50 hover:bg-teal-300/15"
              >
                View Plans
              </Link>
            </div>

            {purchase === "success" ? (
              <div className="mt-8 rounded-3xl border border-emerald-300/25 bg-emerald-300/10 p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-50">
                      Governance capacity funded successfully
                    </h3>

                    <p className="mt-2 max-w-2xl text-sm text-emerald-100">
                      Your Truvern credits were added successfully. You can now
                      continue requesting expert governance reviews, accelerate
                      vendor reviews, and expand operational review capacity.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={returnTo}
                      className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                    >
                      Continue Workflow
                    </Link>

                    <Link
                      href="/vendors"
                      className="rounded-full border border-emerald-200/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      View Vendors
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {purchase === "cancelled" ? (
              <div className="mt-8 rounded-3xl border border-amber-300/25 bg-amber-300/10 p-5 text-sm text-amber-100">
                Checkout was cancelled. No credits were purchased.
              </div>
            ) : null}
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
              <p className="text-sm text-emerald-100">Available credits</p>
              <p className="mt-3 text-4xl font-semibold">
                {balance.availableCredits}
              </p>
            </div>

            <div className="rounded-3xl border border-sky-300/20 bg-sky-300/10 p-5">
              <p className="text-sm text-sky-100">Reserved credits</p>
              <p className="mt-3 text-4xl font-semibold">
                {balance.reservedCredits}
              </p>
            </div>

            <div className="rounded-3xl border border-purple-300/20 bg-purple-300/10 p-5">
              <p className="text-sm text-purple-100">Consumed credits</p>
              <p className="mt-3 text-4xl font-semibold">
                {balance.consumedCredits}
              </p>
            </div>

            <div className="rounded-3xl border border-teal-300/25 bg-teal-300/10 p-5">
              <p className="text-sm text-teal-100">Effective capacity</p>
              <p className="mt-3 text-4xl font-semibold">
                {balance.effectiveCredits}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              Credits are reserved before expert work begins.
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              Credits are consumed only when governance is finalized.
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              Reserved credits can be reversed when eligible workflows reopen.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Funding Activity
            </h2>

            <p className="mt-3 max-w-2xl text-slate-300">
              Immutable governance funding history tied directly to review
              operations and lifecycle events.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="grid min-w-[900px] grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-4 border-b border-white/10 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <div>Event</div>
            <div>Type</div>
            <div>Available</div>
            <div>Reserved</div>
            <div>Consumed</div>
            <div>Date</div>
          </div>

          {activity.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-400">
              No ledger activity yet.
            </div>
          ) : (
            visibleActivity.map((row) => (
              <div
                key={row.id}
                className="grid min-w-[900px] grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-4 border-b border-white/5 px-6 py-5 text-sm"
              >
                <div>
                  <p className="font-medium text-white">
                    {activityTitle(row)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {activitySource(row)}
                  </p>
                </div>

                <div>
                  <span className={`rounded-full border px-2 py-1 text-xs ${activityBadgeClass(row.entryType)}`}>
                    {row.entryType || "UNKNOWN"}
                  </span>
                </div>

                <div
                  className={deltaClass(
                    safeInt(row.availableDelta),
                  )}
                >
                  {safeInt(row.availableDelta)}
                </div>

                <div
                  className={deltaClass(
                    safeInt(row.reservedDelta),
                  )}
                >
                  {safeInt(row.reservedDelta)}
                </div>

                <div
                  className={deltaClass(
                    safeInt(row.consumedDelta),
                  )}
                >
                  {safeInt(row.consumedDelta)}
                </div>

                <div className="text-slate-400">
                  {formatDate(row.createdAt)}
                </div>
              </div>
            ))
          )}

          {hiddenActivity.length > 0 ? (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-center border-t border-white/10 px-6 py-4 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/10">
                <span className="group-open:hidden">
                  Show {hiddenActivity.length} more funding activities
                </span>
                <span className="hidden group-open:inline">
                  Show fewer funding activities
                </span>
              </summary>

              <div>
                {hiddenActivity.map((row) => (
                  <div
                    key={row.id}
                    className="grid min-w-[900px] grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-4 border-b border-white/5 px-6 py-5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {activityTitle(row)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {activitySource(row)}
                      </p>
                    </div>

                    <div>
                      <span className={`rounded-full border px-2 py-1 text-xs ${activityBadgeClass(row.entryType)}`}>
                        {row.entryType || "UNKNOWN"}
                      </span>
                    </div>

                    <div className={deltaClass(safeInt(row.availableDelta))}>
                      {safeInt(row.availableDelta)}
                    </div>

                    <div className={deltaClass(safeInt(row.reservedDelta))}>
                      {safeInt(row.reservedDelta)}
                    </div>

                    <div className={deltaClass(safeInt(row.consumedDelta))}>
                      {safeInt(row.consumedDelta)}
                    </div>

                    <div className="text-slate-400">
                      {formatDate(row.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              What Truvern Credits Do
            </h2>

            <p className="mt-4 text-slate-300">
              Truvern Credits are not just billing units. They represent access
              to governance execution capacity: expert review, assessment
              acceleration, evidence validation, and release-ready governance
              documentation.
            </p>

            <p className="mt-4 text-slate-300">
              One credit typically represents one Truvern expert governance
              review request.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03]">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight">
            Transparent Credit Lifecycle
          </h2>

          <p className="mt-4 max-w-3xl text-slate-300">
            Truvern connects credits directly to governance outcomes. This keeps
            expert work accountable, auditable, and aligned to finalized review
            activity.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {lifecycle.map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border border-white/10 bg-slate-950/70 p-5"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-teal-300 text-sm font-bold text-slate-950">
                  {index + 1}
                </div>

                <p className="text-sm font-medium text-white">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="credit-packs"
        className="mx-auto max-w-7xl px-6 py-16 lg:px-8"
      >
        <div className="mb-8">
          <h2 className="text-3xl font-semibold tracking-tight">
            Credit Packs
          </h2>

          <p className="mt-3 max-w-2xl text-slate-300">
            Choose the governance capacity that fits your current workload.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {packs.map((pack) => (
            <div
              key={pack.name}
              className={[
                "rounded-3xl border p-6 shadow-2xl",
                pack.featured
                  ? "border-teal-300/40 bg-teal-300/[0.08] shadow-teal-950/40"
                  : "border-white/10 bg-white/[0.04]",
              ].join(" ")}
            >
              {pack.featured ? (
                <p className="mb-4 inline-flex rounded-full bg-teal-300 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-950">
                  Recommended
                </p>
              ) : null}

              <h3 className="text-2xl font-semibold">
                {pack.name}
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                {pack.useCase}
              </p>

              <div className="mt-6">
                <span className="text-5xl font-semibold">
                  {pack.credits}
                </span>

                <span className="ml-2 text-slate-300">
                  credits
                </span>
              </div>

              <p className="mt-6 min-h-20 text-sm leading-6 text-slate-300">
                {pack.description}
              </p>

              <CreditCheckoutButton
                pack={pack.key}
                label={`Select ${pack.name}`}
                featured={pack.featured}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          <h2 className="text-2xl font-semibold">
            Built for Flexible Governance
          </h2>

          <p className="mt-4 max-w-4xl text-slate-300">
            Truvern does not force every review into a paid expert workflow.
            Your team can continue handling reviews internally, while Truvern
            Credits provide professional acceleration when you need additional
            capacity, independent validation, or faster governance execution.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="font-semibold">
                Request Expert Help
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                Send high-risk or sensitive vendors to Truvern for expert review.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="font-semibold">
                Expedite Governance
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                Use credits to handle assessment spikes and reduce review delays.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="font-semibold">
                Scale Operations
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                Support continuous governance workflows without expanding
                headcount.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}













