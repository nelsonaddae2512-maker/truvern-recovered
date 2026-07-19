import Link from "next/link";
import prisma from "@/lib/prisma";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";
import { getGovernanceHealthState } from "@/lib/governance/governance-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type NetworkRow = {
  organizationId: number;
  organizationName: string | null;
  planTier: string | null;
  availableCredits: number;
  reservedCredits: number;
  consumedCredits: number;
  vendorCount: number;
  activeReviews: number;
  truvernReviews: number;
  unclaimedTruvernReviews: number;
  releaseReadyReviews: number;
  finalizedReviews: number;
  lastActivityAt: Date | string | null;
};

function safeInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

function safeStr(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : "—";
}

function dateLabel(v: Date | string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

function healthBadge(updatedAt: Date | string | null) {
  const state = getGovernanceHealthState(updatedAt);

  const styles = {
    HEALTHY: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    WATCH: "border-yellow-400/20 bg-yellow-500/10 text-yellow-100",
    AT_RISK: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    EXPIRED: "border-rose-400/20 bg-rose-500/10 text-rose-100",
  }[state];

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}>
      {state.replace("_", " ")}
    </span>
  );
}

export default async function TruvernOpsNetworkPage() {
  await requireTruvernOperator();

  const proofRows = await prisma.$queryRawUnsafe<Array<{
    freeUsers: number;
    proUsers: number;
    enterpriseUsers: number;
    totalUsers: number;
    totalAssessments: number;
    submittedAssessments: number;
    completedReviews: number;
    releasedGovernanceRecords: number;
  }>>(`
    select
      count(distinct o.id) filter (
        where upper(coalesce(o."planTier"::text, 'FREE')) = 'FREE'
      )::int as "freeUsers",

      count(distinct o.id) filter (
        where upper(coalesce(o."planTier"::text, 'FREE')) = 'PRO'
      )::int as "proUsers",

      count(distinct o.id) filter (
        where upper(coalesce(o."planTier"::text, 'FREE')) = 'ENTERPRISE'
      )::int as "enterpriseUsers",

      count(distinct o.id)::int as "totalUsers",

      (select count(*)::int from "AssessmentRun") as "totalAssessments",

      (select count(*)::int from "AssessmentRun"
       where upper(coalesce(status::text, '')) in ('SUBMITTED', 'COMPLETED', 'REVIEWED')
      ) as "submittedAssessments",

      (select count(*)::int from "ReviewAssignment"
       where upper(coalesce(status::text, '')) in ('COMPLETED', 'RELEASED', 'CONFIRMED')
      ) as "completedReviews",

      (select count(*)::int from "GovernanceReleaseManifest") as "releasedGovernanceRecords"

    from "Organization" o
  `);

  const proof = proofRows[0] ?? {
    freeUsers: 0,
    proUsers: 0,
    enterpriseUsers: 0,
    totalUsers: 0,
    totalAssessments: 0,
    submittedAssessments: 0,
    completedReviews: 0,
    releasedGovernanceRecords: 0,
  };

  const rows = await prisma.$queryRawUnsafe<NetworkRow[]>(`
    select
      o.id as "organizationId",
      o.name as "organizationName",
      coalesce(upper(o."planTier"::text), 'FREE') as "planTier",

      coalesce(credits."availableCredits", 0)::int as "availableCredits",
      abs(coalesce(credits."reservedCredits", 0))::int as "reservedCredits",
      coalesce(credits."consumedCredits", 0)::int as "consumedCredits",

      coalesce(vendors."vendorCount", 0)::int as "vendorCount",
      coalesce(reviews."activeReviews", 0)::int as "activeReviews",
      coalesce(reviews."truvernReviews", 0)::int as "truvernReviews",
      coalesce(reviews."unclaimedTruvernReviews", 0)::int as "unclaimedTruvernReviews",
      coalesce(reviews."releaseReadyReviews", 0)::int as "releaseReadyReviews",
      coalesce(reviews."finalizedReviews", 0)::int as "finalizedReviews",

      greatest(
        coalesce(o."updatedAt", o."createdAt"),
        coalesce(reviews."lastReviewActivityAt", o."createdAt"),
        coalesce(credits."lastCreditActivityAt", o."createdAt")
      ) as "lastActivityAt"

    from "Organization" o

    left join (
      select
        "organizationId",
        count(*)::int as "vendorCount"
      from "Vendor"
      group by "organizationId"
    ) vendors on vendors."organizationId" = o.id

    left join (
      select
        "organizationId",
        coalesce(sum("availableDelta"), 0)::int as "availableCredits",
        coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
        coalesce(sum("consumedDelta"), 0)::int as "consumedCredits",
        max("createdAt") as "lastCreditActivityAt"
      from "TruvernCreditLedgerEntry"
      where status = 'POSTED'::text
      group by "organizationId"
    ) credits on credits."organizationId" = o.id

    left join (
      select
        ra."organizationId",

        count(*) filter (
          where upper(coalesce(ra.status::text, '')) in ('PENDING', 'IN_PROGRESS')
        )::int as "activeReviews",

        count(*) filter (
          where upper(coalesce(ra."assignmentType"::text, '')) = 'TRUVERN'
        )::int as "truvernReviews",

        count(*) filter (
          where upper(coalesce(ra."assignmentType"::text, '')) = 'TRUVERN'
            and ra."reviewerUserId" is null
            and upper(coalesce(ra.status::text, '')) in ('PENDING', 'REQUESTED', 'QUEUED')
        )::int as "unclaimedTruvernReviews",

        count(*) filter (
          where upper(coalesce(ra."assignmentType"::text, '')) = 'TRUVERN'
            and upper(coalesce(latest.responses->>'intent', '')) = 'COMPLETE'
            and upper(coalesce(latest.responses->>'releaseState', '')) not in ('RELEASED', 'CONFIRMED')
        )::int as "releaseReadyReviews",

        count(*) filter (
          where upper(coalesce(latest.responses->>'releaseState', '')) = 'CONFIRMED'
        )::int as "finalizedReviews",

        max(ra."updatedAt") as "lastReviewActivityAt"

      from "ReviewAssignment" ra

      left join lateral (
        select responses
        from "ReviewResponse"
        where "reviewAssignmentId" = ra.id
        order by "updatedAt" desc
        limit 1
      ) latest on true

      group by ra."organizationId"
    ) reviews on reviews."organizationId" = o.id

    order by
      coalesce(reviews."unclaimedTruvernReviews", 0) desc,
      coalesce(reviews."releaseReadyReviews", 0) desc,
      coalesce(credits."availableCredits", 0) asc,
      "lastActivityAt" desc
    limit 100
  `);

  const totals = rows.reduce(
    (acc, row) => {
      acc.organizations += 1;
      acc.vendors += safeInt(row.vendorCount);
      acc.truvernReviews += safeInt(row.truvernReviews);
      acc.unclaimed += safeInt(row.unclaimedTruvernReviews);
      acc.releaseReady += safeInt(row.releaseReadyReviews);
      acc.lowBalance += safeInt(row.availableCredits) <= 5 ? 1 : 0;
      return acc;
    },
    {
      organizations: 0,
      vendors: 0,
      truvernReviews: 0,
      unclaimed: 0,
      releaseReady: 0,
      lowBalance: 0,
    },
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-white">
      <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
        Truvern Ops Network
      </p>

      <h1 className="mt-3 text-4xl font-semibold">Customer network</h1>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
        Network proof dashboard for customer growth, plan mix, assessment volume, governance releases, funding posture, Truvern review volume, claim backlog, and governance health.
      </p>

      <section className="mt-8 grid gap-4 lg:grid-cols-4">
        <Metric label="Total customers" value={safeInt(proof.totalUsers)} tone="cyan" />
        <Metric label="Free customers" value={safeInt(proof.freeUsers)} tone="sky" />
        <Metric label="Pro customers" value={safeInt(proof.proUsers)} tone="violet" />
        <Metric label="Enterprise customers" value={safeInt(proof.enterpriseUsers)} tone="emerald" />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-4">
        <Metric label="Total assessments" value={safeInt(proof.totalAssessments)} tone="cyan" />
        <Metric label="Submitted assessments" value={safeInt(proof.submittedAssessments)} tone="amber" />
        <Metric label="Completed reviews" value={safeInt(proof.completedReviews)} tone="violet" />
        <Metric label="Release manifests" value={safeInt(proof.releasedGovernanceRecords)} tone="emerald" />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-6">
        <Metric label="Organizations" value={totals.organizations} tone="cyan" />
        <Metric label="Vendors" value={totals.vendors} tone="emerald" />
        <Metric label="Truvern reviews" value={totals.truvernReviews} tone="violet" />
        <Metric label="Unclaimed" value={totals.unclaimed} tone="amber" />
        <Metric label="Ready release" value={totals.releaseReady} tone="sky" />
        <Metric label="Low balance" value={totals.lowBalance} tone="rose" />
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Network command graph
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Customer governance portfolio
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/truvern/ops/funding"
              className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15"
            >
              Open Funding
            </Link>

            <Link
              href="/truvern/ops/reviews"
              className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/15"
            >
              Open Review Queue
            </Link>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-[1200px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Vendors</th>
                <th className="px-4 py-3">Active reviews</th>
                <th className="px-4 py-3">Truvern reviews</th>
                <th className="px-4 py-3">Unclaimed</th>
                <th className="px-4 py-3">Ready</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.organizationId}
                  className="border-b border-white/5 text-slate-200"
                >
                  <td className="px-4 py-4">
                    <p className="font-semibold text-white">
                      {safeStr(row.organizationName)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Org #{row.organizationId}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                      {safeStr(row.planTier)}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <p className={safeInt(row.availableCredits) <= 5 ? "font-semibold text-amber-100" : "font-semibold text-emerald-100"}>
                        {safeInt(row.availableCredits)} available
                      </p>
                      <p className="text-xs text-slate-500">
                        {safeInt(row.reservedCredits)} reserved · {safeInt(row.consumedCredits)} consumed
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-4">{safeInt(row.vendorCount)}</td>
                  <td className="px-4 py-4">{safeInt(row.activeReviews)}</td>
                  <td className="px-4 py-4">{safeInt(row.truvernReviews)}</td>

                  <td className="px-4 py-4">
                    <span className={safeInt(row.unclaimedTruvernReviews) > 0 ? "font-semibold text-amber-100" : "text-slate-400"}>
                      {safeInt(row.unclaimedTruvernReviews)}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <span className={safeInt(row.releaseReadyReviews) > 0 ? "font-semibold text-violet-100" : "text-slate-400"}>
                      {safeInt(row.releaseReadyReviews)}
                    </span>
                  </td>

                  <td className="px-4 py-4">{healthBadge(row.lastActivityAt)}</td>

                  <td className="px-4 py-4 text-slate-400">
                    {dateLabel(row.lastActivityAt)}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/truvern/ops/funding/${row.organizationId}`}
                        className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/15"
                      >
                        Funding
                      </Link>

                      <Link
                        href={`/review-desk?type=truvern&orgId=${row.organizationId}`}
                        className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/15"
                      >
                        Reviews
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    No customer organizations found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cyan" | "emerald" | "violet" | "amber" | "sky" | "rose";
}) {
  const classes = {
    cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    violet: "border-violet-400/20 bg-violet-500/10 text-violet-100",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    sky: "border-sky-400/20 bg-sky-500/10 text-sky-100",
    rose: "border-rose-400/20 bg-rose-500/10 text-rose-100",
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 ${classes}`}>
      <p className="text-sm">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

