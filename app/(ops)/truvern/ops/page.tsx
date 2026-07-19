import Link from "next/link";
import prisma from "@/lib/prisma";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type AnyRow = Record<string, any>;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function safeInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export default async function TruvernOpsPage() {
  await requireTruvernOperator();

  const orgRows: AnyRow[] = await prisma.$queryRawUnsafe(`
    select count(*)::int as "count"
    from "Organization"
  `);

  const vendorRows: AnyRow[] = await prisma.$queryRawUnsafe(`
    select count(*)::int as "count"
    from "Vendor"
  `);

  const reviewRows: AnyRow[] = await prisma.$queryRawUnsafe(`
    select
      count(distinct ra.id) filter (
        where upper(coalesce(latest.responses->>'assignmentType', '')) = 'TRUVERN'
          and upper(coalesce(latest.responses->>'releaseState', '')) not in (
            'RELEASED',
            'CONFIRMED'
          )
      )::int as "activeReviews",

      count(distinct ra.id) filter (
        where upper(coalesce(latest.responses->>'assignmentType', '')) = 'TRUVERN'
          and upper(coalesce(latest.responses->>'intent', '')) = 'COMPLETE'
          and upper(coalesce(latest.responses->>'releaseState', '')) not in (
            'RELEASED',
            'CONFIRMED'
          )
      )::int as "releaseReadyReviews"

    from "ReviewAssignment" ra

    left join lateral (
      select responses
      from "ReviewResponse"
      where "reviewAssignmentId" = ra.id
      order by "updatedAt" desc
      limit 1
    ) latest on true
  `);

  const creditRows: AnyRow[] = await prisma.$queryRawUnsafe(`
    select
      coalesce(sum("availableDelta"), 0)::int as "availableCredits",
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
      coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
    from "TruvernCreditLedgerEntry"
  `);

  const overrideRows: AnyRow[] = await prisma.$queryRawUnsafe(`
    select
      opo.*,
      o.name as "organizationName"
    from "OrganizationPlanOverride" opo
    left join "Organization" o on o.id = opo."organizationId"
    where opo."revokedAt" is null
      and opo."startsAt" <= now()
      and (opo."expiresAt" is null or opo."expiresAt" > now())
    order by opo."createdAt" desc, opo.id desc
    limit 8
  `);

  const lowBalanceRows: AnyRow[] = await prisma.$queryRawUnsafe(`
    select
      o.id,
      o.name,
      coalesce(c."availableCredits", 0)::int as "availableCredits"
    from "Organization" o
    left join (
      select
        "organizationId",
        coalesce(sum("availableDelta"), 0)::int as "availableCredits"
      from "TruvernCreditLedgerEntry"
      group by "organizationId"
    ) c on c."organizationId" = o.id
    where coalesce(c."availableCredits", 0) <= 5
    order by coalesce(c."availableCredits", 0) asc, o."createdAt" desc
    limit 6
  `);

  const totalOrganizations = safeInt(orgRows?.[0]?.count);
  const totalVendors = safeInt(vendorRows?.[0]?.count);
  const activeReviews = safeInt(reviewRows?.[0]?.activeReviews);
  const releaseReadyReviews = safeInt(reviewRows?.[0]?.releaseReadyReviews);
  const availableCredits = safeInt(creditRows?.[0]?.availableCredits);
  const reservedCredits = Math.abs(safeInt(creditRows?.[0]?.reservedCredits));
  const consumedCredits = safeInt(creditRows?.[0]?.consumedCredits);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-white">
            <section className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-6 shadow-2xl shadow-cyan-500/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Managed Assessment Operations
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
              Truvern Ops can receive vendor requests and complete the assessment lifecycle.
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Customers submit vendors, Truvern Ops distributes the assessment,
              reviewers validate evidence, findings and remediation are generated,
              and the customer receives a clean governance release package.
            </p>
          </div>

          <a
            href="/managed-assessments"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            View Public Offer
          </a>
        </div>
      </section>
<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
            Truvern Ops
          </p>

          <h1 className="mt-3 text-4xl font-semibold">
            Operations Command Center
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Internal operator workspace for funding controls, governance review
            throughput, customer enablement, and network oversight.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/truvern/ops/funding"
            className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/20"
          >
            Open Funding
          </Link>

          <Link
            href="/review-desk"
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-white/[0.09]"
          >
            Open Governance Ops
          </Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-4">
        <MetricCard label="Organizations" value={totalOrganizations} tone="cyan" />
        <MetricCard label="Vendors" value={totalVendors} tone="emerald" />
        <MetricCard label="Active Truvern reviews" value={activeReviews} tone="violet" />
        <MetricCard label="Ready for release" value={releaseReadyReviews} tone="amber" />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-4">
        <MetricCard
          label="Customer available"
          value={availableCredits}
          tone="emerald"
        />

        <MetricCard
          label="Reserved credits"
          value={reservedCredits}
          tone="cyan"
        />

        <MetricCard
          label="Consumed credits"
          value={consumedCredits}
          tone="violet"
        />

        <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
          <p className="text-sm text-amber-100">
            Operator funding
          </p>

          <p className="mt-3 text-3xl font-semibold text-white">
            Unlimited
          </p>

          <p className="mt-3 text-xs leading-5 text-amber-100/80">
            Internal Truvern review operations bypass customer prepaid credit limits.
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
                Active overrides
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                Pilot access controls
              </h2>
            </div>

            <Link
              href="/truvern/ops/funding"
              className="text-sm font-semibold text-cyan-100 hover:text-cyan-50"
            >Manage {'->'}</Link>
          </div>

          <div className="mt-5 grid gap-3">
            {overrideRows.length ? (
              overrideRows.map((row) => (
                <Link
                  key={String(row.id)}
                  href={`/truvern/ops/funding/${row.organizationId}`}
                  className="rounded-2xl border border-cyan-400/15 bg-cyan-500/10 p-4 hover:border-cyan-300/30"
                >
                  <p className="font-semibold text-white">
                    {safeStr(row.organizationName) ||
                      `Organization #${row.organizationId}`}
                  </p>

                  <p className="mt-1 text-sm text-cyan-100">
                    {safeStr(row.planTier) || "Override"} access
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {safeStr(row.reason) || "No reason provided"}
                  </p>
                </Link>
              ))
            ) : (
              <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                No active plan overrides.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                Funding watch
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                Low balance organizations
              </h2>
            </div>

            <Link
              href="/truvern/ops/funding"
              className="text-sm font-semibold text-amber-100 hover:text-amber-50"
            >View all {'->'}</Link>
          </div>

          <div className="mt-5 grid gap-3">
            {lowBalanceRows.length ? (
              lowBalanceRows.map((row) => (
                <Link
                  key={String(row.id)}
                  href={`/truvern/ops/funding/${row.id}`}
                  className="rounded-2xl border border-amber-400/15 bg-amber-500/10 p-4 hover:border-amber-300/30"
                >
                  <p className="font-semibold text-white">
                    {safeStr(row.name) || `Organization #${row.id}`}
                  </p>

                  <p className="mt-1 text-sm text-amber-100">
                    {safeInt(row.availableCredits)} available credits
                  </p>
                </Link>
              ))
            ) : (
              <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                No low-balance organizations.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        <OpsLink
          href="/truvern/ops/funding"
          eyebrow="Funding"
          title="Funding & Overrides"
          body="Grant credits, review customer balances, and manage pilot or demo enablement."
        />

        <OpsLink
          href="/truvern/ops/network"
          eyebrow="Network"
          title="Customer Network"
          body="View organizations, vendors, review volume, and governance coverage across Truvern."
        />

        <OpsLink
          href="/truvern/ops/reviews"
          eyebrow="Reviews"
          title="Ops Governance Ops"
          body="Operate expert review throughput, assignments, release readiness, and escalation state."
        />
      </section>
    
      <section className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
          Governance Office
        </p>

        <h2 className="mt-3 text-2xl font-semibold text-white">
          Governance operations dashboard
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/80">
          Open the workflow-powered governance office, task queue, workflow queue, and release operations views.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/governance" className="rounded-2xl border border-lime-300/25 bg-lime-400/10 px-4 py-2 text-sm font-semibold text-lime-100 hover:bg-lime-400/20">
            Governance Dashboard
          </a>

          <a href="/review-desk/workflow-queue" className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20">
            Workflow Queue
          </a>

          <a href="/review-desk/tasks" className="rounded-2xl border border-indigo-300/25 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-400/20">
            Task Queue
          </a>

          <a href="/truvern/ops/command-center" className="rounded-2xl border border-violet-300/25 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-400/20">
            Command Center
          </a>
        </div>
      </section>

    </main>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cyan" | "emerald" | "violet" | "amber";
}) {
  const classes = {
    cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    violet: "border-violet-400/20 bg-violet-500/10 text-violet-100",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-100",
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 ${classes}`}>
      <p className="text-sm">{label}</p>
      <p className="mt-3 text-4xl font-semibold text-white">{value}</p>
    </div>
  );
}

function OpsLink({
  href,
  eyebrow,
  title,
  body,
}: {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-cyan-300/30 hover:bg-cyan-500/10"
    >
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
        {eyebrow}
      </p>

      <h2 className="mt-4 text-2xl font-semibold">{title}</h2>

      <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
    </Link>
  );
}








