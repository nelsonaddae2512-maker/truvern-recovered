import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";
import { getGovernanceHealthState } from "@/lib/governance/governance-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MetricRow = {
  totalReviews: number;
  unclaimedReviews: number;
  releaseReady: number;
  awaitingConfirmation: number;
  finalized: number;
  manifestBacked: number;
};

type QueueRow = {
  assignmentId: number;
  vendorName: string | null;
  status: string | null;
  releaseState: string | null;
  reviewerUserId: string | null;
  updatedAt: Date | string | null;
  manifestId: number | null;
};

function safeInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

function dateLabel(v: Date | string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

function statusLabel(row: QueueRow) {
  return String(row.releaseState || row.status || "PENDING").toUpperCase();
}


function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function getManagedAssessmentMetrics(row: any) {
  const responsePayload = safeObject(row?.response?.responses ?? row?.latestResponses ?? row?.responses);
  const snapshot = safeObject(responsePayload.governanceReleaseSnapshot);
  const intelligence = safeObject(responsePayload.truvernReviewerIntelligence);

  const remediation = safeObject(
    responsePayload.truvernRemediation ??
      snapshot.remediationSnapshot ??
      snapshot.remediation,
  );

  const findings =
    safeArray(intelligence.findings).length > 0
      ? safeArray(intelligence.findings)
      : safeArray(snapshot.findingsSnapshot).length > 0
        ? safeArray(snapshot.findingsSnapshot)
        : safeArray(responsePayload.findings);

  const followUps =
    safeArray(intelligence.followUps).length > 0
      ? safeArray(intelligence.followUps)
      : safeArray(snapshot.followUpsSnapshot).length > 0
        ? safeArray(snapshot.followUpsSnapshot)
        : safeArray(snapshot.reviewerConditionsSnapshot);

  const releaseState = String(responsePayload.releaseState ?? snapshot.releaseState ?? "").toUpperCase();

  const completionPercent =
    typeof intelligence.completionPercent === "number"
      ? intelligence.completionPercent
      : releaseState === "CONFIRMED" || releaseState === "RELEASED"
        ? 100
        : typeof row?.completionPercent === "number"
          ? row.completionPercent
          : 0;

  const riskLevel = String(
    responsePayload.riskLevel ??
      snapshot.riskLevel ??
      responsePayload.residualRisk ??
      snapshot.residualRisk ??
      "",
  ).toUpperCase();

  const derivedRiskScore =
    riskLevel === "CRITICAL"
      ? 95
      : riskLevel === "HIGH"
        ? 80
        : riskLevel === "MEDIUM"
          ? 50
          : riskLevel === "LOW"
            ? 20
            : 0;

  const autoRiskScore =
    typeof intelligence.autoRiskScore === "number"
      ? intelligence.autoRiskScore
      : typeof snapshot.autoRiskScoreSnapshot === "number"
        ? snapshot.autoRiskScoreSnapshot
        : findings.length > 0
          ? findings.filter((finding) => String(finding?.severity ?? "").toUpperCase() === "HIGH").length * 25 +
            findings.filter((finding) => String(finding?.severity ?? "").toUpperCase() === "MEDIUM").length * 10 +
            findings.filter((finding) => String(finding?.severity ?? "").toUpperCase() === "LOW").length * 3
          : derivedRiskScore;

  const submittedAt =
    row?.submittedAt ||
    row?.createdAt ||
    row?.updatedAt
      ? new Date(row.submittedAt || row.createdAt || row.updatedAt)
      : null;

  const dueAt = row?.dueAt
    ? new Date(row.dueAt)
    : submittedAt
      ? new Date(submittedAt.getTime() + 7 * 86_400_000)
      : row?.createdAt
        ? new Date(new Date(row.createdAt).getTime() + 7 * 86_400_000)
        : null;

  const finalizedAt =
    responsePayload?.confirmedAt ||
    responsePayload?.releasedAt ||
    snapshot?.confirmedAt ||
    snapshot?.releasedAt;

  const now = finalizedAt
    ? new Date(finalizedAt)
    : new Date();

  const slaAgingDays = submittedAt
    ? Math.max(
        1,
        Math.floor((now.getTime() - submittedAt.getTime()) / 86_400_000),
      )
    : 1;

  const daysUntilDue = dueAt
    ? Math.ceil((dueAt.getTime() - now.getTime()) / 86_400_000)
    : null;

  const reopenRequested =
    Boolean(row?.reopenRequested) ||
    String(row?.status ?? "").toUpperCase().includes("REOPEN") ||
    String(responsePayload.releaseState ?? "").toUpperCase().includes("REOPEN");

  return {
    completionPercent,
    autoRiskScore: Math.min(100, Math.max(0, Math.round(autoRiskScore))),
    findingsCount:
      findings.length > 0
        ? findings.length
        : releaseState === "CONFIRMED" || releaseState === "RELEASED"
          ? 1
          : 0,
    highFindingsCount:
      findings.filter((finding) => String(finding?.severity ?? "").toUpperCase() === "HIGH").length ||
      (riskLevel === "HIGH" || riskLevel === "CRITICAL" ? 1 : 0),
    followUpsCount: followUps.length,
    slaAgingDays,
    daysUntilDue,
    dueLabel:
      dueAt
        ? (
            daysUntilDue !== null && daysUntilDue < 0
              ? `Overdue ${Math.abs(daysUntilDue)}d`
              : dueAt.toLocaleDateString()
          )
        : "No due date",
    reopenRequested,
    remediationStatus: remediation.remediationStatus ?? null,
    remediationDueAt: remediation.remediationDueAt ?? null,
    attestationCount: safeArray(remediation.attestationRequests).length,
    remediationHistoryCount: safeArray(remediation.history).length,
  };
}
function ManagedAssessmentQueueCard({ row }: { row: any }) {
  const metrics = getManagedAssessmentMetrics(row);
  const vendorName = row?.vendor?.name ?? row?.vendorName ?? "Unknown vendor";
  const requesterName =
    row?.requester?.name ??
    row?.request?.requesterName ??
    row?.organization?.name ??
    row?.customer?.name ??
    "Requester not assigned";

  const assignmentId = row?.id ?? row?.assignmentId;
  const reviewHref = `/review-desk/${assignmentId}`;

  return (
    <article className="rounded-3xl border border-cyan-400/20 bg-slate-950/70 p-5 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Assignment #{assignmentId ?? "—"} · Truvern Review
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">{vendorName}</h3>
          <p className="mt-1 text-sm text-slate-300">Requester: {requesterName}</p>
        </div>

        <a
          href={reviewHref}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/20"
        >
          Open review
        </a>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Completion</p>
          <p className="mt-2 text-lg font-semibold text-white">{metrics.completionPercent}%</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Auto-risk</p>
          <p className="mt-2 text-lg font-semibold text-white">{metrics.autoRiskScore}/100</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Findings</p>
          <p className="mt-2 text-lg font-semibold text-white">{metrics.findingsCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">High</p>
          <p className="mt-2 text-lg font-semibold text-white">{metrics.highFindingsCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">SLA aging</p>
          <p className="mt-2 text-lg font-semibold text-white">{metrics.slaAgingDays}d</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Due</p>
          <p className="mt-2 text-sm font-semibold text-white">{metrics.dueLabel}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {metrics.reopenRequested ? (
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
            Reopen requested
          </span>
        ) : null}
        {metrics.autoRiskScore >= 70 ? (
          <span className="rounded-full border border-red-300/30 bg-red-300/10 px-3 py-1 text-xs font-semibold text-red-100">
            High governance risk
          </span>
        ) : null}
        {metrics.followUpsCount > 0 ? (
          <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            {metrics.followUpsCount} follow-ups
          </span>
        ) : null}
        {metrics.remediationStatus ? (
          <span className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1 text-xs font-semibold text-violet-100">
            {metrics.remediationStatus}
          </span>
        ) : null}
        {metrics.attestationCount > 0 ? (
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
            {metrics.attestationCount} attestations
          </span>
        ) : null}
        {metrics.daysUntilDue !== null && metrics.daysUntilDue < 0 ? (
          <span className="rounded-full border border-orange-300/30 bg-orange-300/10 px-3 py-1 text-xs font-semibold text-orange-100">
            Overdue
          </span>
        ) : null}
      </div>
    </article>
  );
}

export default async function TruvernOpsReviewsPage() {
  await requireTruvernOperator();
  const { userId } = await auth();

  const metricRows = await prisma.$queryRawUnsafe<MetricRow[]>(`
    select
      count(distinct ra.id)::int as "totalReviews",

      count(distinct ra.id) filter (
        where ra."reviewerUserId" is null
          and upper(coalesce(ra.status::text, '')) in ('PENDING', 'REQUESTED', 'QUEUED')
      )::int as "unclaimedReviews",

      count(distinct ra.id) filter (
        where upper(coalesce(latest.responses->>'intent', '')) = 'COMPLETE'
          and upper(coalesce(latest.responses->>'releaseState', '')) not in ('RELEASED', 'CONFIRMED')
      )::int as "releaseReady",

      count(distinct ra.id) filter (
        where upper(coalesce(latest.responses->>'releaseState', '')) = 'RELEASED'
      )::int as "awaitingConfirmation",

      count(distinct ra.id) filter (
        where upper(coalesce(latest.responses->>'releaseState', '')) = 'CONFIRMED'
      )::int as "finalized",

      count(distinct gm.id)::int as "manifestBacked"

    from "ReviewAssignment" ra

    left join lateral (
      select id, responses
      from "ReviewResponse"
      where "reviewAssignmentId" = ra.id
      order by "updatedAt" desc
      limit 1
    ) latest on true

    left join "GovernanceReleaseManifest" gm
      on gm."reviewResponseId" = latest.id

    where upper(coalesce(ra."assignmentType"::text, '')) = 'TRUVERN'
  `);

  const metrics = metricRows[0] ?? {
    totalReviews: 0,
    unclaimedReviews: 0,
    releaseReady: 0,
    awaitingConfirmation: 0,
    finalized: 0,
    manifestBacked: 0,
  };

  const unclaimedReviews = await prisma.$queryRawUnsafe<QueueRow[]>(`
    select
      ra.id as "assignmentId",
      v.name as "vendorName",
      ra.status::text as status,
      coalesce(latest.responses->>'releaseState', ra.status::text) as "releaseState",
      ra."reviewerUserId",
      ra."updatedAt",
      gm.id as "manifestId",
      latest.responses as responses
    from "ReviewAssignment" ra
    left join "ReviewRequest" rr on rr.id = ra."reviewRequestId"
    left join "Vendor" v on v.id = coalesce(rr."vendorId", ra."vendorId")
    left join lateral (
      select id, responses
      from "ReviewResponse"
      where "reviewAssignmentId" = ra.id
      order by "updatedAt" desc
      limit 1
    ) latest on true
    left join "GovernanceReleaseManifest" gm
      on gm."reviewResponseId" = latest.id
    where upper(coalesce(ra."assignmentType"::text, '')) = 'TRUVERN'
      and ra."reviewerUserId" is null
      and upper(coalesce(ra.status::text, '')) in ('PENDING', 'REQUESTED', 'QUEUED')
      and upper(coalesce(latest.responses->>'releaseState', '')) not in ('RELEASED', 'CONFIRMED')
    order by ra."updatedAt" asc
    limit 20
  `);

  const releaseReadyReviews = await prisma.$queryRawUnsafe<QueueRow[]>(`
    select
      ra.id as "assignmentId",
      v.name as "vendorName",
      ra.status::text as status,
      coalesce(latest.responses->>'releaseState', ra.status::text) as "releaseState",
      ra."reviewerUserId",
      ra."updatedAt",
      gm.id as "manifestId",
      latest.responses as responses
    from "ReviewAssignment" ra
    left join "ReviewRequest" rr on rr.id = ra."reviewRequestId"
    left join "Vendor" v on v.id = coalesce(rr."vendorId", ra."vendorId")
    left join lateral (
      select id, responses
      from "ReviewResponse"
      where "reviewAssignmentId" = ra.id
      order by "updatedAt" desc
      limit 1
    ) latest on true
    left join "GovernanceReleaseManifest" gm
      on gm."reviewResponseId" = latest.id
    where upper(coalesce(ra."assignmentType"::text, '')) = 'TRUVERN'
      and upper(coalesce(latest.responses->>'intent', '')) = 'COMPLETE'
      and upper(coalesce(latest.responses->>'releaseState', '')) not in ('RELEASED', 'CONFIRMED')
    order by ra."updatedAt" asc
    limit 20
  `);

  const recentReviews = await prisma.$queryRawUnsafe<QueueRow[]>(`
    select
      ra.id as "assignmentId",
      v.name as "vendorName",
      ra.status::text as status,
      coalesce(latest.responses->>'releaseState', ra.status::text) as "releaseState",
      ra."reviewerUserId",
      ra."updatedAt",
      gm.id as "manifestId",
      latest.responses as responses
    from "ReviewAssignment" ra
    left join "ReviewRequest" rr on rr.id = ra."reviewRequestId"
    left join "Vendor" v on v.id = coalesce(rr."vendorId", ra."vendorId")
    left join lateral (
      select id, responses
      from "ReviewResponse"
      where "reviewAssignmentId" = ra.id
      order by "updatedAt" desc
      limit 1
    ) latest on true
    left join "GovernanceReleaseManifest" gm
      on gm."reviewResponseId" = latest.id
    where upper(coalesce(ra."assignmentType"::text, '')) = 'TRUVERN'
    order by
      case
        when ra."reviewerUserId" is null then 0
        when upper(coalesce(latest.responses->>'releaseState', '')) = 'RELEASED' then 1
        when upper(coalesce(latest.responses->>'releaseState', '')) = 'CONFIRMED' then 3
        else 2
      end asc,
      ra."updatedAt" desc
    limit 50
  `);

  const finalizedReviews = recentReviews.filter(
    (row) => statusLabel(row) === "CONFIRMED",
  );

  const governanceHealthCounts = finalizedReviews.reduce(
    (acc, row) => {
      const state = getGovernanceHealthState(row.updatedAt);
      acc[state] += 1;
      return acc;
    },
    {
      HEALTHY: 0,
      WATCH: 0,
      AT_RISK: 0,
      EXPIRED: 0,
    } as Record<ReturnType<typeof getGovernanceHealthState>, number>,
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-white">

      <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6 shadow-[0_0_35px_rgba(34,211,238,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">Submitted questionnaire queue</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Managed Vendor Assessments</h2>
        <p className="mt-2 max-w-4xl text-sm text-slate-300">
          Operational lane for submitted vendor reviews, due dates, completion percentage, requester, vendor, SLA aging, auto-risk score, findings, reopen requests, remediation follow-ups, and release readiness.
        </p>
      </section>

      {/* Truvern Review queue cards */}
      <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6 shadow-[0_0_35px_rgba(34,211,238,0.08)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">Submitted questionnaire queue</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Managed Vendor Assessments</h2>
            <p className="mt-2 max-w-4xl text-sm text-slate-300">
              Submitted vendor reviews with due date, completion, requester, vendor, SLA aging, auto-risk score, reopen requests, findings, remediation, and release readiness.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {recentReviews.slice(0, 6).map((row: any) => (
            <ManagedAssessmentQueueCard key={row.id ?? row.assignmentId} row={row} />
          ))}
        </div>
      </section>
      <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
        Truvern Ops Reviews
      </p>

      <h1 className="mt-3 text-4xl font-semibold">Operator Review Queue</h1>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
        Truvern reviewer workbench for claimed reviews, unclaimed routed work,
        release readiness, customer confirmation, and finalized governance history.
      </p>

      <section className="mt-8 grid gap-4 lg:grid-cols-4">
        <MetricCard label="Governance healthy" value={governanceHealthCounts.HEALTHY} tone="emerald" />
        <MetricCard label="Governance watch" value={governanceHealthCounts.WATCH} tone="yellow" />
        <MetricCard label="Governance at risk" value={governanceHealthCounts.AT_RISK} tone="amber" />
        <MetricCard label="Governance expired" value={governanceHealthCounts.EXPIRED} tone="rose" />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-5">
        <MetricCard label="Total routed reviews" value={safeInt(metrics.totalReviews)} tone="cyan" />
        <MetricCard label="Unclaimed reviews" value={safeInt(metrics.unclaimedReviews)} tone="amber" />
        <MetricCard label="Ready for release" value={safeInt(metrics.releaseReady)} tone="violet" />
        <MetricCard label="Awaiting confirmation" value={safeInt(metrics.awaitingConfirmation)} tone="amber" />
        <MetricCard label="Finalized" value={safeInt(metrics.finalized)} tone="emerald" />
      </section>

      <section className="mt-10 rounded-3xl border border-cyan-400/20 bg-cyan-500/[0.06] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Priority claim lane
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Unclaimed Truvern reviews
            </h2>
          </div>

          <Link
            href="/review-desk?view=all&type=truvern&owner=unassigned&sort=oldest"
            className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15"
          >
            Open unclaimed queue
          </Link>
        </div>

        <QueueList rows={unclaimedReviews} currentUserId={userId} empty="No routed Truvern reviews are waiting for an operator claim." />
      </section>

      <section className="mt-8 rounded-3xl border border-violet-400/20 bg-violet-500/[0.06] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-violet-200">
              Release readiness lane
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Completed reviews awaiting Truvern release
            </h2>
          </div>

          <Link
            href="/review-desk?view=release_ready&type=truvern&sort=oldest"
            className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/15"
          >
            Open release queue
          </Link>
        </div>

        <QueueList rows={releaseReadyReviews} currentUserId={userId} empty="No Truvern reviews are ready for release." />
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Live operations
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              All routed Truvern reviews
            </h2>
          </div>

          <Link
            href="/review-desk?view=all&type=truvern&sort=recent"
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/[0.08]"
          >
            Open full queue
          </Link>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-slate-400">
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Assignment</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Ownership</th>
                <th className="px-4 py-3">Manifest</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {recentReviews.map((row) => (
                <tr key={row.assignmentId} className="border-b border-white/5 text-slate-200">
                  <td className="px-4 py-4 font-medium text-white">
                    {row.vendorName || "Unknown vendor"}
                  </td>
                  <td className="px-4 py-4">#{row.assignmentId}</td>
                  <td className="px-4 py-4">{statusLabel(row)}</td>
                  <td className="px-4 py-4">
                    {row.reviewerUserId === userId ? "Claimed by you" : row.reviewerUserId ? "Claimed" : "Unclaimed"}
                  </td>
                  <td className="px-4 py-4">
                    {row.manifestId ? `#${row.manifestId}` : "—"}
                  </td>
                  <td className="px-4 py-4 text-slate-400">
                    {dateLabel(row.updatedAt)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/review-desk/reviews/${row.assignmentId}`}
                      className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/15"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function QueueList({
  rows,
  currentUserId,
  empty,
}: {
  rows: QueueRow[];
  currentUserId: string | null;
  empty: string;
}) {
  return (
    <div className="mt-6 space-y-3">
      {rows.length ? (
        rows.map((row) => (
          <div
            key={row.assignmentId}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-5 py-4"
          >
            <div>
              <p className="font-semibold text-white">
                {row.vendorName || "Unknown vendor"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Assignment #{row.assignmentId} · {statusLabel(row)} · {dateLabel(row.updatedAt)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {!row.reviewerUserId ? (
                <form
                  action={`/api/review-desk/reviews/${row.assignmentId}/claim?returnTo=/truvern/ops/reviews`}
                  method="POST"
                >
                  <button
                    type="submit"
                    className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15"
                  >
                    Fast claim
                  </button>
                </form>
              ) : null}

              {row.reviewerUserId === currentUserId ? (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  Claimed by you
                </span>
              ) : null}

              <Link
                href={`/review-desk/reviews/${row.assignmentId}`}
                className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15"
              >
                Open
              </Link>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-6 text-sm text-slate-400">
          {empty}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cyan" | "emerald" | "violet" | "amber" | "yellow" | "rose";
}) {
  const classes = {
    cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    violet: "border-violet-400/20 bg-violet-500/10 text-violet-100",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    yellow: "border-yellow-400/20 bg-yellow-500/10 text-yellow-100",
    rose: "border-rose-400/20 bg-rose-500/10 text-rose-100",
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 ${classes}`}>
      <p className="text-sm">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}













