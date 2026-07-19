// app/review-desk/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import ReviewDeskSubmissionActions from "@/components/review-desk/review-desk-intake-actions.client";
import ReviewAssignmentWorkspace from "@/components/review-desk/review-assignment-workspace.client";
import { isTruvernOperator } from "@/lib/truvern-ops-access";
import ClaimReviewButton from "@/components/review-desk/claim-review-button.client";
import {
  ReviewQueueBulkCheckbox,
  ReviewQueueBulkProvider,
  ReviewQueueBulkToolbar,
} from "@/components/review-desk/review-queue-bulk-actions.client";
import { clerkClient } from "@clerk/nextjs/server";
import GovernanceArtifactsDrawer from "@/components/review-desk/governance-artifacts-drawer.client";
import { requireDbOrganization } from "@/lib/org-db";
import { getCurrentPlanEntitlements } from "@/lib/billing/plan-entitlements";
import FrameworkAssessmentCard from "@/components/review-desk/framework-assessment-card";
import { getCurrentOrgPlanTier } from "@/lib/billing/plan-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{
    vendorId?: string;
    mode?: string;
    requestId?: string;
    assignmentId?: string;
    view?: string;
    q?: string;
    type?: string;
    owner?: string;
    sort?: string;
bulkAssigned?: string;
bulkSkipped?: string;
bulkReleased?: string;
bulkReleaseSkipped?: string;
  }>;
};

type AnyRow = Record<string, any>;

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function upper(v: unknown) {
  return safeStr(v).toUpperCase();
}

function iso(v: unknown) {
  if (!v) return null;
  const d = new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function hoursBetween(date: string | null) {
  if (!date) return 0;
  const then = new Date(date).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60));
}

function relativeTime(date: string | null) {
  const hours = hoursBetween(date);
  if (!date) return "Updated unknown";
  if (hours < 1) return "Updated just now";
  if (hours < 24) return `Updated ${hours}h ago`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "Updated 1 day ago" : `Updated ${days} days ago`;
}

function agingTone(hours: number) {
  if (hours >= 72) {
    return {
      label: "Overdue",
      className: "border-rose-400/20 bg-rose-500/10 text-rose-100",
    };
  }

  if (hours >= 24) {
    return {
      label: "Aging",
      className: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    };
  }

  return {
    label: "Healthy",
    className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  };
}

function queueOutcomeStatus(row: AnyRow) {
  const responses =
    row.latestResponses && typeof row.latestResponses === "object"
      ? row.latestResponses
      : {};

  const releaseState = upper(
    responses?.releaseState ||
      row.releaseState ||
      row.outcomeReleaseState,
  );

  const intent = upper(
    responses?.intent ||
      row.intent ||
      row.outcomeIntent,
  );

  const assignmentStatus = upper(row.status);

  if (releaseState === "CONFIRMED") {
    return "CONFIRMED";
  }

  if (releaseState === "RELEASED" || intent === "RELEASE") {
    return "AWAITING_CONFIRMATION";
  }

  if (
    releaseState === "COMPLETED" ||
    intent === "COMPLETE" ||
    assignmentStatus === "SUBMITTED"
  ) {
    return "READY_FOR_REVIEW";
  }

  if (assignmentStatus === "IN_PROGRESS") {
    return "IN_PROGRESS";
  }

  return assignmentStatus || "OPEN";
}

function queueIntegrityStatus(row: AnyRow) {
  const responses =
    row.latestResponses && typeof row.latestResponses === "object"
      ? row.latestResponses
      : {};

  const snapshot =
    responses?.governanceReleaseSnapshot &&
    typeof responses.governanceReleaseSnapshot === "object"
      ? responses.governanceReleaseSnapshot
      : null;

  const seal =
    snapshot?.governanceSeal &&
    typeof snapshot.governanceSeal === "object"
      ? snapshot.governanceSeal
      : responses?.governanceSeal || null;

  if (!snapshot) {
    return {
      label: "SNAPSHOT MISSING",
      className:
        "border-rose-400/20 bg-rose-500/10 text-rose-100",
    };
  }

  if (!seal?.checksum) {
    return {
      label: "UNSEALED",
      className:
        "border-amber-400/20 bg-amber-500/10 text-amber-100",
    };
  }

  return {
    label: "VERIFIED",
    className:
      "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  };
}

function queueReviewer(
  row: AnyRow,
  reviewerNameMap?: Map<string, string>,
) {
  const reviewerUserId = safeStr(row.reviewerUserId);
return (
    safeStr(row.assignedReviewerName) ||
    safeStr(row.reviewerName) ||
    safeStr(row.assignedTo) ||
    (reviewerUserId && reviewerNameMap?.get(reviewerUserId)) ||
    (
  upper(row.assignmentType) === "TRUVERN"
    ? "Truvern expert"
    : reviewerUserId
      ? "Internal reviewer"
      : "Truvern Review Team"
)
  );
}

function queueHasOwner(
  row: AnyRow,
  reviewerNameMap?: Map<string, string>,
) {
  return queueReviewer(row, reviewerNameMap) !== "Truvern Review Team";
}

function queuePriorityScore(
  row: AnyRow,
  reviewerNameMap?: Map<string, string>,
) {
  const updatedAt = iso(row.updatedAt);
  const ageHours = hoursBetween(updatedAt);
  const status = queueOutcomeStatus(row);
  const hasOwner = queueHasOwner(row, reviewerNameMap);

  let score = ageHours;

  if (!hasOwner) score += 1000;
  if (ageHours >= 72) score += 2000;
  if (status === "CONFIRMED") score -= 5000;

if (status === "AWAITING_CONFIRMATION") {
  score += 3000 + ageHours;
}

  return score;
}

function queueUrl(
  view: string,
  q: string,
  type: string,
  owner: string,
  sort: string,
) {
  const params = new URLSearchParams();

  params.set("view", view);

  if (q) params.set("q", q);
  if (type !== "all") params.set("type", type);
  if (owner !== "all") params.set("owner", owner);
  if (sort !== "priority") params.set("sort", sort);

  return `/review-desk?${params.toString()}`;
}

function queueQuickUrl(params: {
  view?: string;
  type?: string;
  owner?: string;
  sort?: string;
  q?: string;
}) {
  const search = new URLSearchParams();

  if (params.view) search.set("view", params.view);

  if (params.type && params.type !== "all") {
    search.set("type", params.type);
  }

  if (params.owner && params.owner !== "all") {
    search.set("owner", params.owner);
  }

  if (params.sort && params.sort !== "priority") {
    search.set("sort", params.sort);
  }

  if (params.q) {
    search.set("q", params.q);
  }

  return `/review-desk?${search.toString()}`;
}

function isQuickFilterActive(
  queueView: string,
  queueType: string,
  queueOwner: string,
  queueSort: string,
  target: {
    view?: string;
    type?: string;
    owner?: string;
    sort?: string;
  },
) {
return (
    queueView === (target.view ?? "active") &&
    queueType === (target.type ?? "all") &&
    queueOwner === (target.owner ?? "all") &&
    queueSort === (target.sort ?? "priority")
  );
}

async function one<T extends AnyRow>(
  query: TemplateStringsArray,
  ...values: any[]
): Promise<T | null> {
  try {
    const rows: any[] = await prisma.$queryRaw(query, ...values);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function many<T extends AnyRow>(
  query: TemplateStringsArray,
  ...values: any[]
): Promise<T[]> {
  try {
    return await prisma.$queryRaw(query, ...values);
  } catch {
    return [];
  }
}

async function countRaw(
  query: TemplateStringsArray,
  ...values: any[]
): Promise<number> {
  try {
    const rows: any[] = await prisma.$queryRaw(query, ...values) as Array<{ count: bigint | number | string }>;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
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
  const intelligence = safeObject(responsePayload.truvernReviewerIntelligence);
  const remediation = safeObject(responsePayload.truvernRemediation);

  const findings = safeArray(intelligence.findings);
  const followUps = safeArray(intelligence.followUps);

  const completionPercent =
    typeof intelligence.completionPercent === "number"
      ? intelligence.completionPercent
      : typeof row?.completionPercent === "number"
        ? row.completionPercent
        : 0;

  const autoRiskScore =
    typeof intelligence.autoRiskScore === "number"
      ? intelligence.autoRiskScore
      : findings.filter((finding) => String(finding?.severity ?? "").toUpperCase() === "HIGH").length * 25 +
        findings.filter((finding) => String(finding?.severity ?? "").toUpperCase() === "MEDIUM").length * 10 +
        findings.filter((finding) => String(finding?.severity ?? "").toUpperCase() === "LOW").length * 3;

  const dueAt = row?.dueAt ? new Date(row.dueAt) : null;
  const submittedAt = row?.submittedAt || row?.createdAt || row?.updatedAt ? new Date(row.submittedAt || row.createdAt || row.updatedAt) : null;
  const now = new Date();

  const slaAgingDays = submittedAt
    ? Math.max(0, Math.floor((now.getTime() - submittedAt.getTime()) / 86_400_000))
    : 0;

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
    findingsCount: findings.length,
    highFindingsCount: findings.filter((finding) => String(finding?.severity ?? "").toUpperCase() === "HIGH").length,
    followUpsCount: followUps.length,
    slaAgingDays,
    daysUntilDue,
    dueLabel: dueAt ? dueAt.toLocaleDateString() : "No due date",
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
            Assignment #{assignmentId ?? "€”"} · Truvern Review
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

export default async function ReviewDeskPage({ searchParams }: Props) {
  const canManageTruvernReview = await isTruvernOperator();
  const resolved = (await searchParams) ?? {};

  const vendorIdFromUrl = safeInt(resolved.vendorId);
  const requestIdFromUrl = safeInt(resolved.requestId);
  const assignmentId = safeInt(resolved.assignmentId);
  const engagementMode = Boolean(assignmentId);
  // Inline Governance Ops workspace stays on this page.
  const mode = safeStr(resolved.mode).toLowerCase();
  const view = safeStr(resolved.view).toLowerCase();
  const q = safeStr(resolved.q);
  const type = safeStr(resolved.type).toLowerCase();
  const owner = safeStr(resolved.owner).toLowerCase();
  const sort = safeStr(resolved.sort).toLowerCase();
  const bulkAssigned = safeInt(resolved.bulkAssigned) ?? 0;
  const bulkSkipped = safeInt(resolved.bulkSkipped) ?? 0;
  const bulkReleased = safeInt(resolved.bulkReleased) ?? 0;
  const bulkReleaseSkipped = safeInt(resolved.bulkReleaseSkipped) ?? 0;
  const queueView =
  view === "release_ready"
    ? "release_ready"
    : view === "awaiting_confirmation"
      ? "awaiting_confirmation"
      : view === "confirmed"
        ? "confirmed"
        : view === "released"
          ? "released"
          : view === "all"
            ? "all"
            : "active";

  const queueType =
    type === "truvern" ? "truvern" : type === "internal" ? "internal" : "all";

  const queueOwner =
    owner === "Truvern Review Team"
      ? "Truvern Review Team"
      : owner === "assigned"
        ? "assigned"
        : "all";

  const queueSort =
    sort === "oldest" ? "oldest" : sort === "recent" ? "recent" : "priority";

  const org = await requireDbOrganization();

  if ("_needsOrgSelection" in org) {
    redirect("/dashboard");
  }

  const organizationId = org.id;
  const entitlements = await getCurrentPlanEntitlements();

  const currentPlanTier = await getCurrentOrgPlanTier();

  const isFreePlan = currentPlanTier === "FREE";
  const isProPlan = currentPlanTier === "PRO";
  const isEnterprisePlan = currentPlanTier === "ENTERPRISE";

  const canAccessGovernanceArtifacts =
    currentPlanTier === "PRO" ||
    currentPlanTier === "ENTERPRISE";

  // FREE_GOVERNANCE_QUEUE_VIEW_REDIRECT
  if (
    !canAccessGovernanceArtifacts &&
    ["release_ready", "awaiting_confirmation", "confirmed"].includes(queueView)
  ) {
    redirect("/review-desk?view=all");
  }

  const frameworkAssessments = await prisma.truvernFrameworkAssessment.findMany({
    where: {
      OR: [
        { organizationId },
        { organizationId: null },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 12,
    include: {
      framework: {
        select: {
          name: true,
          version: true,
          slug: true,
        },
      },
      findings: {
        select: {
          severity: true,
          status: true,
          remediationRequired: true,
          attestationRequired: true,
        },
      },
      attestations: {
        select: {
          status: true,
        },
      },
      _count: {
        select: {
          responses: true,
          findings: true,
          attestations: true,
        },
      },
    },
  });

  const frameworkAssessmentCards = frameworkAssessments.map((assessment) => ({
    id: assessment.id,
    title: assessment.title,
    status: assessment.status,
    score: assessment.score,
    maxScore: assessment.maxScore,
    riskLevel: assessment.riskLevel,
    vendorId: assessment.vendorId,
    organizationId: assessment.organizationId,
    readyForReleaseAt: assessment.readyForReleaseAt,
    releasedAt: assessment.releasedAt,
    updatedAt: assessment.updatedAt,
    framework: assessment.framework,
    counts: assessment._count,
    findingSummary: {
      critical: assessment.findings.filter((finding) => finding.severity === "CRITICAL").length,
      high: assessment.findings.filter((finding) => finding.severity === "HIGH").length,
      open: assessment.findings.filter((finding) => finding.status === "OPEN").length,
      remediationRequired: assessment.findings.filter((finding) => finding.remediationRequired).length,
      attestationRequired: assessment.findings.filter((finding) => finding.attestationRequired).length,
      attestationsOpen: assessment.attestations.filter((attestation) => attestation.status === "REQUESTED").length,
    },
  }));

  const frameworkReadyForReleaseCount = frameworkAssessmentCards.filter(
    (assessment) => assessment.status === "READY_FOR_RELEASE",
  ).length;

  const frameworkRemediationCount = frameworkAssessmentCards.filter(
    (assessment) => assessment.status === "REMEDIATION_REQUESTED",
  ).length;

  const frameworkAttestationCount = frameworkAssessmentCards.filter(
    (assessment) => assessment.status === "ATTESTATION_REQUESTED",
  ).length;

  const recentAssignments = await many<AnyRow>`
    select *
    from (
      select
        ra.id,
        ra.status::text as status,
        'INTERNAL'::text as "assignmentType",
        ra."updatedAt",
        ra."reviewerUserId",
        null::text as "assignedReviewerName",
        null::text as "reviewerName",
        null::text as "assignedTo",
        rr.id as "requestId",
        v.id as "vendorId",
        v.name as "vendorName",
        v.category as "vendorCategory",
        null::int as "assessmentId",
        null::text as "assessmentTitle",
        latest.id as "latestResponseId",
        gm.id as "manifestId",
        latest.responses as "latestResponses",
        0::int as "queuePriority"
      from "ReviewAssignment" ra
      left join "ReviewRequest" rr on rr.id = ra."reviewRequestId"
      inner join "Vendor" v
        on v.id = rr."vendorId"
       and v."organizationId" = ${organizationId}

      left join lateral (
        select
          r.id,
          r.responses
        from "ReviewResponse" r
        where r."reviewAssignmentId" = ra.id
        order by r."updatedAt" desc
        limit 1
      ) latest on true

      left join "GovernanceReleaseManifest" gm
        on gm."reviewResponseId" = latest.id

      union all

      select
        a.id::int as id,
        a.status::text as status,
        'INTAKE'::text as "assignmentType",
        coalesce(a."submittedAt", a."reviewReadyAt", a."updatedAt") as "updatedAt",
        null::text as "reviewerUserId",
        null::text as "assignedReviewerName",
        null::text as "reviewerName",
        null::text as "assignedTo",
        null::int as "requestId",
        v.id as "vendorId",
        v.name as "vendorName",
        v.category as "vendorCategory",
        a.id as "assessmentId",
        coalesce(a.title, t.name, 'Vendor review') as "assessmentTitle",
        null::int as "latestResponseId",
        null::int as "manifestId",
        jsonb_build_object(
          'source', 'vendor_assessment_intake',
          'assessmentId', a.id,
          'assessmentTitle', coalesce(a.title, t.name, 'Vendor review'),
          'submittedAt', a."submittedAt",
          'completionPercent', a."completionPercent",
          'score', a.score
        ) as "latestResponses",
        10::int as "queuePriority"
      from "Assessment" a
      join "Vendor" v
        on v.id = a."vendorId"
       and v."organizationId" = ${organizationId}
      left join "AssessmentTemplate" t on t.id = a."templateId"
      where a."isVendorSubmitted" = true
        and a.status in (
          'SUBMITTED'::"AssessmentStatus",
          'REVIEW_READY'::"AssessmentStatus"
        )
        and not exists (
          select 1
          from "ReviewRequest" rr2
          join "ReviewAssignment" ra2
            on ra2."reviewRequestId" = rr2.id
          where rr2."assessmentId" = a.id
            and ra2.status in (
              'PENDING'::text,
              'IN_PROGRESS'::text,
              'SUBMITTED'::text
            )
        )
    ) queue
    order by "queuePriority" desc, "updatedAt" desc
    limit 75
  `;
    const reviewerIds = Array.from(
    new Set(
      recentAssignments
        .map((row) => safeStr(row.reviewerUserId))
        .filter(Boolean),
    ),
  );
const creditLedgerRows =
    assignmentId && assignmentId > 0
      ? await prisma.$queryRawUnsafe<
          Array<{
            entryType: string;
            availableDelta: number;
            reservedDelta: number;
            consumedDelta: number;
            quantity: number;
            note: string | null;
            createdAt: Date | string | null;
          }>
        >(
          `
          select
            "entryType"::text as "entryType",
            "availableDelta",
            "reservedDelta",
            "consumedDelta",
            quantity,
            note,
            "createdAt"
          from "TruvernCreditLedgerEntry"
          where "reviewAssignmentId" = $1
            and status::text = 'POSTED'
          order by "createdAt" asc, id asc
          `,
          assignmentId,
        )
      : [];
  const reviewerNameMap = new Map<string, string>();

  if (reviewerIds.length) {
    try {
      const clerk = await clerkClient();

      const users = await clerk.users.getUserList({
        userId: reviewerIds,
        limit: reviewerIds.length,
      });

      for (const user of users.data) {
        const displayName =
          safeStr(user.fullName) ||
          [safeStr(user.firstName), safeStr(user.lastName)]
            .filter(Boolean)
            .join(" ") ||
          safeStr(user.primaryEmailAddress?.emailAddress);

        if (displayName) {
          reviewerNameMap.set(user.id, displayName);
        }
      }
    } catch {
      // noop
    }
  }

  const searchNeedle = q.toLowerCase();

  const matchingAssignments = recentAssignments.filter((row) => {
    const vendorName = safeStr(row.vendorName).toLowerCase();
    const assignmentType = upper(row.assignmentType);
    const hasOwner = queueHasOwner(row);

    const matchesSearch =
  searchNeedle === "release-ready"
    ? queueOutcomeStatus(row) === "READY_FOR_REVIEW"
    : !searchNeedle ||
      vendorName.includes(searchNeedle) ||
      String(row.id).includes(searchNeedle) ||
      String(row.requestId ?? "").includes(searchNeedle);

    const matchesType =
      queueType === "all" ||
      (queueType === "internal" && assignmentType !== "TRUVERN") ||
      (queueType === "truvern" && assignmentType === "TRUVERN");

    const matchesOwner =
      queueOwner === "all" ||
      (queueOwner === "Truvern Review Team" && !hasOwner) ||
      (queueOwner === "assigned" && hasOwner);

    return matchesSearch && matchesType && matchesOwner;
  });

  const filteredAssignments = [...matchingAssignments]
  .filter((row) => {
    const status = queueOutcomeStatus(row);

    if (queueView === "all") {
      return true;
    }

    if (queueView === "release_ready") {
      return status === "READY_FOR_REVIEW";
    }

    if (queueView === "awaiting_confirmation") {
      return status === "AWAITING_CONFIRMATION";
    }

    if (queueView === "confirmed") {
      return status === "CONFIRMED";
    }

    if (queueView === "released") {
return (
        status === "AWAITING_CONFIRMATION" ||
        status === "CONFIRMED"
      );
    }
return (
      status !== "CONFIRMED" &&
      status !== "AWAITING_CONFIRMATION"
    );
  })
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();

      if (queueSort === "recent") {
        return bTime - aTime;
      }

      if (queueSort === "oldest") {
        return aTime - bTime;
      }
return (
  queuePriorityScore(b, reviewerNameMap) -
  queuePriorityScore(a, reviewerNameMap)
);
    });

  const activeCount = matchingAssignments.filter(
    (row) => queueOutcomeStatus(row) !== "RELEASED",
  ).length;

  const releasedCount = matchingAssignments.filter(
    (row) => queueOutcomeStatus(row) === "RELEASED",
  ).length;
  
  const releaseReadyCount = matchingAssignments.filter(
  (row) => queueOutcomeStatus(row) === "READY_FOR_REVIEW",
).length;

  const allCount = matchingAssignments.length;

  const unassignedCount = matchingAssignments.filter(
  (row) => !queueHasOwner(row, reviewerNameMap),
).length;
  const slaAttentionCount = matchingAssignments.filter((row) => {
  const status = queueOutcomeStatus(row);
  const updatedAt = iso(row.updatedAt);
  const ageHours = hoursBetween(updatedAt);
return (
  status !== "CONFIRMED" &&
  status !== "AWAITING_CONFIRMATION" &&
  ageHours >= 24
);
}).length;
  const awaitingConfirmationCount = matchingAssignments.filter(
  (row) =>
    queueOutcomeStatus(row) === "AWAITING_CONFIRMATION",
).length;

const confirmedCount = matchingAssignments.filter(
  (row) =>
    queueOutcomeStatus(row) === "CONFIRMED",
).length;

const verifiedIntegrityCount = matchingAssignments.filter((row) => {
  if (queueOutcomeStatus(row) !== "CONFIRMED") return false;

  const responses =
    row.latestResponses && typeof row.latestResponses === "object"
      ? row.latestResponses
      : {};

  const snapshot =
    responses?.governanceReleaseSnapshot &&
    typeof responses.governanceReleaseSnapshot === "object"
      ? responses.governanceReleaseSnapshot
      : null;

  const seal =
    snapshot?.governanceSeal &&
    typeof snapshot.governanceSeal === "object"
      ? snapshot.governanceSeal
      : responses?.governanceSeal || null;

  return !!snapshot && !!seal?.checksum;
}).length;

const snapshotMissingCount = matchingAssignments.filter((row) => {
  if (queueOutcomeStatus(row) !== "CONFIRMED") return false;

  const responses =
    row.latestResponses && typeof row.latestResponses === "object"
      ? row.latestResponses
      : {};

  return !responses?.governanceReleaseSnapshot;
}).length;

const unsealedCount = matchingAssignments.filter((row) => {
  if (queueOutcomeStatus(row) !== "CONFIRMED") return false;

  const responses =
    row.latestResponses && typeof row.latestResponses === "object"
      ? row.latestResponses
      : {};

  const snapshot =
    responses?.governanceReleaseSnapshot &&
    typeof responses.governanceReleaseSnapshot === "object"
      ? responses.governanceReleaseSnapshot
      : null;

  const seal =
    snapshot?.governanceSeal &&
    typeof snapshot.governanceSeal === "object"
      ? snapshot.governanceSeal
      : responses?.governanceSeal || null;

  return !!snapshot && !seal?.checksum;
}).length;


const portfolioGovernanceRows = await prisma.$queryRawUnsafe<
  Array<{
    vendorId: number;
    vendorName: string | null;
    latestScore: number | null;
    previousScore: number | null;
    remediationCount: number | null;
    missingEvidenceCount: number | null;
    breachDisclosureDetected: boolean | null;
    federalInvestigationDetected: boolean | null;
  }>
>(
  `
  with ranked as (
    select
      vgm.*,
      v.name as "vendorName",
      row_number() over (partition by vgm."vendorId" order by vgm."createdAt" desc) as rn
    from "VendorGovernanceMemory" vgm
    join "Vendor" v on v.id = vgm."vendorId"
    where v."organizationId" = $1
  )
  select
    latest."vendorId",
    latest."vendorName",
    latest."governanceScore" as "latestScore",
    previous."governanceScore" as "previousScore",
    latest."remediationCount",
    latest."missingEvidenceCount",
    latest."breachDisclosureDetected",
    latest."federalInvestigationDetected"
  from ranked latest
  left join ranked previous
    on previous."vendorId" = latest."vendorId"
   and previous.rn = 2
  where latest.rn = 1
  order by latest."createdAt" desc
  limit 50
  `,
  organizationId,
);

const portfolioAverageScore =
  portfolioGovernanceRows.length > 0
    ? Math.round(
        portfolioGovernanceRows.reduce(
          (sum, row) => sum + Number(row.latestScore ?? 0),
          0,
        ) / portfolioGovernanceRows.length,
      )
    : 0;

const deterioratingVendors = portfolioGovernanceRows.filter(
  (row) =>
    typeof row.latestScore === "number" &&
    typeof row.previousScore === "number" &&
    row.latestScore <= row.previousScore - 10,
);

const repeatRemediationVendors = portfolioGovernanceRows.filter(
  (row) => Number(row.remediationCount ?? 0) > 0,
);

const recurringEvidenceGapVendors = portfolioGovernanceRows.filter(
  (row) => Number(row.missingEvidenceCount ?? 0) > 0,
);

const breachHistoryVendors = portfolioGovernanceRows.filter(
  (row) => Boolean(row.breachDisclosureDetected),
);

const federalHistoryVendors = portfolioGovernanceRows.filter(
  (row) => Boolean(row.federalInvestigationDetected),
);
const queueTabs = [
  ["active", "Active", activeCount],
  ["release_ready", "Release Ready", releaseReadyCount],
  ["awaiting_confirmation", "Awaiting Confirmation", awaitingConfirmationCount],
  ["confirmed", "Confirmed", confirmedCount],
  ["all", "All", allCount],
] as const;

  const assignment = assignmentId
    ? await one<AnyRow>`select * from "ReviewAssignment" where id = ${assignmentId} limit 1`
    : null;

  const requestId =
    safeInt(assignment?.requestId) ??
    safeInt(assignment?.reviewRequestId) ??
    requestIdFromUrl;

  const request = requestId
    ? await one<AnyRow>`select * from "ReviewRequest" where id = ${requestId} limit 1`
    : null;

  const vendorId =
    vendorIdFromUrl ??
    safeInt(assignment?.vendorId) ??
    safeInt(request?.vendorId);

  const vendor = vendorId
    ? await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: {
          id: true,
          name: true,
          category: true,
          updatedAt: true,
        },
      })
    : null;

  const latestOutcome = assignmentId
    ? await one<AnyRow>`
        select *
        from "ReviewResponse"
        where "reviewAssignmentId" = ${assignmentId}
        order by "updatedAt" desc
        limit 1
      `
    : null;

  const latestOutcomeResponses =
    latestOutcome &&
    typeof latestOutcome.responses === "object" &&
    latestOutcome.responses !== null
      ? latestOutcome.responses
      : {};

  const evidenceCount = vendorId
    ? await countRaw`select count(*)::text as count from "Evidence" where "vendorId" = ${vendorId}`
    : 0;

  const pendingEvidenceRequests = vendorId
    ? await countRaw`select count(*)::text as count from "EvidenceRequest" where "vendorId" = ${vendorId} and upper(coalesce(status::text, '')) in ('REQUESTED','PENDING','OPEN')`
    : 0;

  const completedEvidenceRequests = vendorId
    ? await countRaw`select count(*)::text as count from "EvidenceRequest" where "vendorId" = ${vendorId} and upper(coalesce(status::text, '')) in ('RECEIVED','APPROVED','COMPLETED','FULFILLED','RESOLVED')`
    : 0;

  const openRemediationRequests = vendorId
    ? await countRaw`select count(*)::text as count from "EvidenceRequest" where "vendorId" = ${vendorId} and upper(coalesce(status::text, '')) not in ('RECEIVED','APPROVED','COMPLETED','FULFILLED','RESOLVED')`
    : 0;

  const approvedRemediationRequests = vendorId
    ? await countRaw`select count(*)::text as count from "EvidenceRequest" where "vendorId" = ${vendorId} and upper(coalesce(status::text, '')) in ('APPROVED','RESOLVED')`
    : 0;
  const orgCreditRows = vendorId
    ? await prisma.$queryRawUnsafe<
        Array<{
          availableCredits: number;
          reservedCredits: number;
          consumedCredits: number;
          effectiveCredits: number;
        }>
      >(
        `
        select
          coalesce(sum(l."availableDelta"), 0)::int as "availableCredits",
          coalesce(sum(l."reservedDelta"), 0)::int as "reservedCredits",
          coalesce(sum(l."consumedDelta"), 0)::int as "consumedCredits",
          (
            coalesce(sum(l."availableDelta"), 0) -
            coalesce(sum(l."reservedDelta"), 0)
          )::int as "effectiveCredits"
        from "Vendor" v
        left join "TruvernCreditLedgerEntry" l
          on l."organizationId" = v."organizationId"
          and l.status::text = 'POSTED'
        where v.id::text = $1::text
        `,
        vendorId,
      )
    : [];

  const orgCreditBalance = orgCreditRows[0] ?? {
    availableCredits: 0,
    reservedCredits: 0,
    consumedCredits: 0,
    effectiveCredits: 0,
  };
  const analystRows = vendorId
    ? await prisma.$queryRawUnsafe<
        Array<{
          userId: string | null;
          name: string | null;
          email: string | null;
          role: string | null;
        }>
      >(
        `
        select
          u.id::text as "userId",
          coalesce(u.name, u.email, 'Internal analyst')::text as name,
          u.email::text as email,
          m.role::text as role
        from "Vendor" v
        join "OrgMembership" m on m."organizationId"::text = v."organizationId"::text
        join "User" u on u.id::text = m."userId"::text
        where v.id::text = $1::text
          and m.role::text in ('OWNER', 'ADMIN', 'ANALYST')
          and u.id is not null
        order by coalesce(u.name, u.email) asc
        `,
        String(vendorId),
      )
    : [];

  const analystOptions = analystRows
    .filter((row) => row.userId)
    .map((row) => ({
      userId: String(row.userId),
      name: safeStr(row.name) || safeStr(row.email) || "Internal analyst",
      email: row.email,
    }));
return (
    <main className="mx-auto max-w-7xl px-6 py-10">

      <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6 shadow-[0_0_35px_rgba(34,211,238,0.08)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">Managed governance operations</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Truvern Reviews</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Submitted vendor reviews requiring Truvern reviewer intelligence: due date, completion, requester, vendor, SLA aging, auto-risk score, reopen requests, findings, remediation, and immutable release readiness.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
            Board-ready · snapshot-backed · seal verified · audit archived · exportable PDF packet
          </div>
        </div>
      </section>

      {/* Truvern Review queue cards */}
      <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6 shadow-[0_0_35px_rgba(34,211,238,0.08)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">Submitted questionnaire queue</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Truvern Reviews</h2>
            <p className="mt-2 max-w-4xl text-sm text-slate-300">
              Submitted vendor reviews with due date, completion, requester, vendor, SLA aging, auto-risk score, reopen requests, findings, remediation, and release readiness.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {filteredAssignments.slice(0, 6).map((row: any) => (
            <ManagedAssessmentQueueCard key={row.id ?? row.assignmentId} row={row} />
          ))}
        </div>
      </section>
      

        {/* PORTFOLIO_GOVERNANCE_INTELLIGENCE */}
        <section className="mt-8 rounded-3xl border border-purple-400/20 bg-purple-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-purple-200">
            Portfolio governance intelligence
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            Vendor risk memory signals
          </h2>

          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-300">
            Longitudinal governance memory from confirmed releases, showing deterioration, recurring remediation,
            disclosure history, and evidence maturity across the vendor portfolio.
          </p>
<div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Avg score</p>
              <p className="mt-3 text-3xl font-semibold text-white">{portfolioAverageScore}</p>
            </div>

            <div className="rounded-3xl border border-red-400/15 bg-red-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-red-100">Deteriorating</p>
              <p className="mt-3 text-3xl font-semibold text-white">{deterioratingVendors.length}</p>
            </div>

            <div className="rounded-3xl border border-amber-400/15 bg-amber-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-amber-100">Remediation repeat</p>
              <p className="mt-3 text-3xl font-semibold text-white">{repeatRemediationVendors.length}</p>
            </div>

            <div className="rounded-3xl border border-cyan-400/15 bg-cyan-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-100">Evidence gaps</p>
              <p className="mt-3 text-3xl font-semibold text-white">{recurringEvidenceGapVendors.length}</p>
            </div>

            <div className="rounded-3xl border border-rose-400/15 bg-rose-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-rose-100">Breach history</p>
              <p className="mt-3 text-3xl font-semibold text-white">{breachHistoryVendors.length}</p>
            </div>

            <div className="rounded-3xl border border-orange-400/15 bg-orange-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-orange-100">Federal history</p>
              <p className="mt-3 text-3xl font-semibold text-white">{federalHistoryVendors.length}</p>
            </div>
          </div>

          {portfolioGovernanceRows.length > 0 ? (
            <div className="mt-6 grid gap-3">
              {portfolioGovernanceRows.slice(0, 5).map((row) => (
                <div
                  key={row.vendorId}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {row.vendorName || `Vendor #${row.vendorId}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Latest score {row.latestScore ?? "€”"}
                        {typeof row.previousScore === "number"
                          ? ` · Previous ${row.previousScore}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {typeof row.latestScore === "number" &&
                      typeof row.previousScore === "number" &&
                      row.latestScore <= row.previousScore - 10 ? (
                        <span className="rounded-full border border-red-300/20 bg-red-400/10 px-3 py-1 text-red-100">
                          Deteriorating
                        </span>
                      ) : null}

                      {Number(row.remediationCount ?? 0) > 0 ? (
                        <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-100">
                          Remediation {Number(row.remediationCount ?? 0)}
                        </span>
                      ) : null}

                      {row.breachDisclosureDetected ? (
                        <span className="rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-rose-100">
                          Breach history
                        </span>
                      ) : null}

                      {row.federalInvestigationDetected ? (
                        <span className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-orange-100">
                          Federal history
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              No confirmed governance memory exists yet. Confirmed releases will populate portfolio intelligence.
            </p>
          )}
        </section>
      <section className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-6 shadow-2xl shadow-cyan-500/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Truvern Reviews
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
              Turn vendor intake into Truvern Review operations.
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Use Truvern Ops to distribute questionnaires, review evidence,
              generate findings, request attestations, coordinate remediation,
              and release clean customer-ready governance reports.
            </p>
          </div>

          <a
            href="/managed-assessments"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            View Managed Workflow
          </a>
        </div>
      </section>
<p className="text-sm uppercase tracking-[0.3em] text-cyan-200">
        Governance queue
      </p>

      <h1 className="mt-3 text-4xl font-semibold text-white">{isFreePlan ? "Review Workspace" : "Governance Ops"}</h1>
       
  {bulkAssigned || bulkSkipped || bulkReleased || bulkReleaseSkipped ? (
  <section className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
    <p className="text-sm font-semibold text-emerald-50">
      Bulk operation complete
    </p>

    {bulkAssigned || bulkSkipped ? (
      <p className="mt-1 text-sm text-slate-300">
        Assigned {bulkAssigned} review{bulkAssigned === 1 ? "" : "s"} to you.
        {bulkSkipped
          ? ` Skipped ${bulkSkipped} already assigned review${
              bulkSkipped === 1 ? "" : "s"
            }.`
          : ""}
      </p>
    ) : null}

    {bulkReleased || bulkReleaseSkipped ? (
      <p className="mt-1 text-sm text-slate-300">
        Released {bulkReleased} review{bulkReleased === 1 ? "" : "s"}.
        {bulkReleaseSkipped
          ? ` Skipped ${bulkReleaseSkipped} review${
              bulkReleaseSkipped === 1 ? "" : "s"
            } that were not release-ready.`
          : ""}
      </p>
    ) : null}
  </section>
) : null}

<section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
  <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
            Active governance queue
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Recent review assignments
          </h2>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <div className="rounded-3xl border border-cyan-400/15 bg-cyan-500/10 p-5">
            <p className="text-sm text-cyan-100">Active reviews</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {activeCount}
            </p>
          </div>

          <Link
            href={canAccessGovernanceArtifacts ? queueUrl("release_ready", q, queueType, queueOwner, queueSort) : queueUrl("all", q, queueType, queueOwner, queueSort)}
            className="rounded-3xl border border-violet-400/15 bg-violet-500/10 p-5 transition hover:border-violet-300/30 hover:bg-violet-500/15"
          >
            <p className="text-sm text-violet-100">{canAccessGovernanceArtifacts ? "Release readiness" : "Assessment readiness"}</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {releaseReadyCount}
            </p>
          </Link>

          <Link
            href={canAccessGovernanceArtifacts ? queueUrl("awaiting_confirmation", q, queueType, queueOwner, queueSort) : queueUrl("all", q, queueType, queueOwner, queueSort)}
            className="rounded-3xl border border-amber-400/15 bg-amber-500/10 p-5 transition hover:border-amber-300/30 hover:bg-amber-500/15"
          >
            <p className="text-sm text-amber-100">
              {canAccessGovernanceArtifacts ? "Awaiting confirmation" : "Pending review"}
            </p>

            <p className="mt-3 text-3xl font-semibold text-white">
              {awaitingConfirmationCount}
            </p>
          </Link>

          <Link
            href={canAccessGovernanceArtifacts ? queueUrl("confirmed", q, queueType, queueOwner, queueSort) : queueUrl("all", q, queueType, queueOwner, queueSort)}
            className="rounded-3xl border border-emerald-400/15 bg-emerald-500/10 p-5 transition hover:border-emerald-300/30 hover:bg-emerald-500/15"
          >
            <p className="text-sm text-emerald-100">{canAccessGovernanceArtifacts ? "Finalized reviews" : "Completed reviews"}</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {confirmedCount}
            </p>
          </Link>
         <div className="rounded-3xl border border-emerald-400/15 bg-emerald-500/10 p-5">
  <p className="text-sm text-emerald-100">
    {canAccessGovernanceArtifacts ? "Governance integrity" : "Review progress"}
  </p>

  <div className="mt-3 space-y-2 text-sm">
    <div className="flex items-center justify-between">
      <span className="text-slate-300">{canAccessGovernanceArtifacts ? "Verified" : "Completed"}</span>
      <span className="font-semibold text-emerald-50">
        {verifiedIntegrityCount}
      </span>
    </div>

    <div className="flex items-center justify-between">
      <span className="text-slate-300">{canAccessGovernanceArtifacts ? "Snapshot missing" : "Needs evidence"}</span>
      <span className="font-semibold text-rose-100">
        {snapshotMissingCount}
      </span>
    </div>

    <div className="flex items-center justify-between">
      <span className="text-slate-300">{canAccessGovernanceArtifacts ? "Unsealed" : "Open"}</span>
      <span className="font-semibold text-amber-100">
        {unsealedCount}
      </span>
    </div>
  </div>
</div>
          <div className="rounded-3xl border border-rose-400/15 bg-rose-500/10 p-5">
            <p className="text-sm text-rose-100">Truvern Review Team</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {unassignedCount}
            </p>
          </div>

          <div className="rounded-3xl border border-amber-400/15 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-100">Filtered results</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {filteredAssignments.length}
            </p>
          </div>
        </div>

        <form
          action="/review-desk"
          className="mt-5 grid gap-3 lg:grid-cols-[1fr_200px_200px_220px_auto]"
        >
          <input type="hidden" name="view" value={queueView} />

          <input
            name="q"
            defaultValue={q}
            placeholder="Search vendor, assignment, or request..."
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />

          <select
            name="type"
            defaultValue={queueType}
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="all">All review types</option>
            <option value="internal">Internal only</option>
            <option value="truvern">Truvern only</option>
          </select>

          <select
            name="owner"
            defaultValue={queueOwner}
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="all">All owners</option>
            <option value="Truvern Review Team">Truvern Review Team only</option>
            <option value="assigned">Assigned only</option>
          </select>

          <select
            name="sort"
            defaultValue={queueSort}
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="priority">Priority sorting</option>
            <option value="oldest">Oldest active first</option>
            <option value="recent">Recently updated</option>
          </select>

          <button
            type="submit"
            className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-5 py-3 text-sm font-medium text-cyan-50 hover:bg-cyan-500/20"
          >
            Apply filters
          </button>
        </form>

        <div className="mt-5 flex flex-wrap gap-3">
          {queueTabs.map(([key, label, count]) => (
            <Link
              key={key}
              href={queueUrl(key, q, queueType, queueOwner, queueSort)}
              className={
                queueView === key
                  ? "rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-50"
                  : "rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.08]"
              }
            >
              {label} · {count}
            </Link>
          ))}

          <Link
            href={queueUrl(queueView, q, queueType, "Truvern Review Team", queueSort)}
            className={
              queueOwner === "Truvern Review Team"
                ? "rounded-2xl border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-50"
                : "rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-500/15"
            }
          >
            Truvern Review Team only · {unassignedCount}
          </Link>

          {q ||
          queueType !== "all" ||
          queueOwner !== "all" ||
          queueSort !== "priority" ? (
            <Link
              href={`/review-desk?view=${queueView}`}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.08]"
            >
              Clear filters
            </Link>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
  {[
    {
      label: "Needs owner",
      href: queueQuickUrl({ view: "active", owner: "Truvern Review Team", sort: "priority" }),
      active: isQuickFilterActive(queueView, queueType, queueOwner, queueSort, {
        view: "active",
        owner: "Truvern Review Team",
        sort: "priority",
      }),
      className: "border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15",
      activeClassName: "border-rose-300/40 bg-rose-500/20 text-rose-50 ring-1 ring-rose-300/30",
    },
    {
      label: "SLA attention",
      href: queueQuickUrl({ view: "active", sort: "oldest" }),
      active: isQuickFilterActive(queueView, queueType, queueOwner, queueSort, {
        view: "active",
        sort: "oldest",
      }),
      className: "border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15",
      activeClassName: "border-amber-300/40 bg-amber-500/20 text-amber-50 ring-1 ring-amber-300/30",
    },
    {
      label: "Truvern active",
      href: queueQuickUrl({ view: "active", type: "truvern", sort: "priority" }),
      active: isQuickFilterActive(queueView, queueType, queueOwner, queueSort, {
        view: "active",
        type: "truvern",
        sort: "priority",
      }),
      className: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15",
      activeClassName: "border-cyan-300/40 bg-cyan-500/20 text-cyan-50 ring-1 ring-cyan-300/30",
    },
    {
      label: "Internal active",
      href: queueQuickUrl({ view: "active", type: "internal", sort: "priority" }),
      active: isQuickFilterActive(queueView, queueType, queueOwner, queueSort, {
        view: "active",
        type: "internal",
        sort: "priority",
      }),
      className: "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]",
      activeClassName: "border-white/20 bg-white/[0.1] text-white ring-1 ring-white/20",
    },
    {
  label: "Release readiness",
  href: queueQuickUrl({
    view: "active",
    sort: "recent",
    q: "release-ready",
  }),
  active:
    queueView === "active" &&
    queueSort === "recent" &&
    q === "release-ready",
  className:
    "border-violet-400/20 bg-violet-500/10 text-violet-100 hover:bg-violet-500/15",
  activeClassName:
    "border-violet-300/40 bg-violet-500/20 text-violet-50 ring-1 ring-violet-300/30",
},
    {
      label: "Finalized recently",
      href: queueQuickUrl({ view: "released", sort: "recent" }),
      active: isQuickFilterActive(queueView, queueType, queueOwner, queueSort, {
        view: "released",
        sort: "recent",
      }),
      className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15",
      activeClassName: "border-emerald-300/40 bg-emerald-500/20 text-emerald-50 ring-1 ring-emerald-300/30",
    },
  ].map((filter) => (
    <Link
      key={filter.label}
      href={filter.href}
      className={[
        "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
        filter.active ? filter.activeClassName : filter.className,
      ].join(" ")}
    >
      {filter.active ? "— " : ""}
      {filter.label}
    </Link>
  ))}
</div>
{q === "release-ready" ? (
  <section className="mt-5 rounded-3xl border border-violet-400/20 bg-violet-500/10 p-5">
    <p className="text-xs uppercase tracking-[0.3em] text-violet-200">
      Release queue
    </p>

    <h3 className="mt-2 text-xl font-semibold text-white">
      Assessments ready for governance review
    </h3>

    <p className="mt-2 max-w-3xl text-sm text-slate-300">
      These vendor-submitted assessments are ready to become governance review assignments. Use the queue selection
      tools to export release-ready items for governance review before adding
      bulk release actions.
    </p>
  </section>
) : null}
        <ReviewQueueBulkProvider>
  <ReviewQueueBulkToolbar
  visibleReviews={filteredAssignments.map((row) => {
    const status = queueOutcomeStatus(row);
    const updatedAt = iso(row.updatedAt);
    const ageHours = hoursBetween(updatedAt);
    const hasOwner = queueHasOwner(row);

    return {
      id: Number(row.id),
      vendorName:
        safeStr(row.vendorName) || `Assignment #${row.id}`,
      assignmentType:
        upper(row.assignmentType) || "INTERNAL",
      status,
      ageBucket:
        status === "CONFIRMED"
          ? "Released"
          : ageHours >= 72
            ? "Overdue"
            : ageHours >= 24
              ? "Aging"
              : "Healthy",
      ownerState: hasOwner ? "Assigned" : "Truvern Review Team",
      recommendation:
        !hasOwner && status !== "CONFIRMED"
          ? "Assign owner"
          : status !== "CONFIRMED" && ageHours >= 24
            ? "SLA follow-up"
            : status === "READY_FOR_REVIEW"
              ? "Ready for governance review"
              : "No action",
    };
  })}
/>

  <div className="mt-6 grid gap-4">
    {filteredAssignments.length ? (
            filteredAssignments.map((row) => {
              const outcomeStatus = queueOutcomeStatus(row);
              const updatedAt = iso(row.updatedAt);
              const ageHours = hoursBetween(updatedAt);
              const aging = agingTone(ageHours);
              const reviewer = queueReviewer(row, reviewerNameMap);
              const hasOwner = queueReviewer(row, reviewerNameMap) !== "Truvern Review Team";
              const latestResponses =
  row.latestResponses && typeof row.latestResponses === "object"
    ? row.latestResponses
    : {};

const snapshot =
  latestResponses?.governanceReleaseSnapshot &&
  typeof latestResponses.governanceReleaseSnapshot === "object"
    ? latestResponses.governanceReleaseSnapshot
    : null;

const seal =
  snapshot?.governanceSeal && typeof snapshot.governanceSeal === "object"
    ? snapshot.governanceSeal
    : latestResponses?.governanceSeal || {};

const integrity = queueIntegrityStatus(row);

              const href =
                upper(row.assignmentType) === "INTAKE"
                  ? `/review-desk/start-review?assessmentId=${row.assessmentId}&vendorId=${row.vendorId}`
                  : `/review-desk/${row.id}`;
return (
  <div
    key={row.id}
    className={[
      "rounded-2xl border p-5 transition",
      outcomeStatus === "CONFIRMED"
        ? "border-white/5 bg-slate-950/20 opacity-70 hover:opacity-100"
        : !hasOwner && ageHours >= 24
          ? "border-rose-400/30 bg-rose-500/[0.08] shadow-lg shadow-rose-950/30 hover:border-rose-300/40"
          : ageHours >= 24
            ? "border-amber-400/20 bg-amber-500/[0.05] hover:border-amber-300/30"
            : "border-white/10 bg-slate-950/30 hover:border-cyan-400/30 hover:bg-cyan-500/[0.06]",
    ].join(" ")}
  >
    <div className="mb-4">
      <ReviewQueueBulkCheckbox
  review={{
    id: Number(row.id),
    vendorName:
      safeStr(row.vendorName) || `Assignment #${row.id}`,
    assignmentType:
      upper(row.assignmentType) || "INTERNAL",
    status: outcomeStatus,
    ageBucket:
      outcomeStatus === "CONFIRMED"
        ? "Released"
        : ageHours >= 72
          ? "Overdue"
          : ageHours >= 24
            ? "Aging"
            : "Healthy",
    ownerState: hasOwner ? "Assigned" : "Truvern Review Team",
    recommendation:
      !hasOwner && outcomeStatus !== "CONFIRMED"
        ? "Assign owner"
        : outcomeStatus !== "CONFIRMED" && ageHours >= 24
          ? "SLA follow-up"
          : outcomeStatus === "COMPLETED"
            ? "Ready for governance review"
            : "No action",
  }}
/>
    </div>

    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-lg font-semibold text-white">
          {safeStr(row.vendorName) || `Assignment #${row.id}`}
        </p>

        <p className="mt-1 text-sm text-slate-400">
          Assignment #{row.id}
          {row.requestId ? ` · Request #${row.requestId}` : ""}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={
              hasOwner
                ? "rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-200"
                : "rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-100"
            }
          >
            {reviewer}
          </span>

          <span className={`rounded-2xl border px-3 py-1 text-xs ${aging.className}`}>
            {aging.label}
          </span>

          <span className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
            {relativeTime(updatedAt)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200">
          {upper(row.assignmentType) || "INTERNAL"}
        </span>

        <span className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">
          {outcomeStatus === "READY_FOR_REVIEW" ? "READY FOR REVIEW" : outcomeStatus.replaceAll("_", " ")}
        </span>

        <span className="hidden h-6 w-px bg-white/10 lg:block" />

        <div className="flex flex-wrap items-center gap-2">
          {!hasOwner &&
          outcomeStatus !== "CONFIRMED" &&
          upper(row.assignmentType) !== "INTAKE" ? (
            <ClaimReviewButton assignmentId={Number(row.id)} />
          ) : null}

          {outcomeStatus === "CONFIRMED" && !canAccessGovernanceArtifacts ? (
            <span className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
              Governance artifacts locked
            </span>
          ) : outcomeStatus === "CONFIRMED" && canAccessGovernanceArtifacts ? (
            <>
              <span className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
  Checksum available
</span>

{(() => {
  const integrity = queueIntegrityStatus(row);
return (
    <span
      className={`rounded-2xl border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${integrity.className}`}
    >
      {integrity.label}
    </span>
  );
})()}
              <Link
                href={`/review-desk/reviews/${row.id}/packet`}
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-500/20"
              >
                View packet
              </Link>

              <Link
                href={`/review-desk/reviews/${row.id}/packet/pdf`}
                className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-500/20"
              >
                PDF
              </Link>
     <Link
  href={`/api/governance/manifests/${encodeURIComponent(
  safeStr(seal?.notarizationReceipt?.receiptId) || String(row.assignmentId)
)}`}
  target="_blank"
  className="rounded-2xl border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-xs font-semibold text-violet-50 transition hover:bg-violet-500/20"
>
  Manifest
</Link>
<Link
    href={`/api/review-desk/reviews/${row.id}/verify-seal`}
  target="_blank"
  className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-500/20"
>
  Verify
</Link>

<GovernanceArtifactsDrawer
  assignmentId={Number(row.id)}
  checksum={safeStr(seal?.checksum)}
  sealVersion={safeStr(seal?.version)}
  sealedAt={safeStr(seal?.sealedAt)}
  integrityStatus={integrity.label}
  receiptId={safeStr(seal?.notarizationReceipt?.receiptId)}
  ledgerHash={safeStr(seal?.notarizationReceipt?.ledgerHash)}
  notarizedAt={safeStr(seal?.notarizationReceipt?.timestamp)}
/>   
         </>
          ) : null}

          {outcomeStatus === "CONFIRMED" && !canAccessGovernanceArtifacts ? (
            <>
              <span className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
                Pro governance feature
              </span>

              <Link
                href="/plans"
                className="rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-50 transition hover:bg-amber-500/20"
              >
                Upgrade
              </Link>
            </>
          ) : null}

          <Link
            href={href}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.09]"
          >
            {upper(row.assignmentType) === "INTAKE" ? "Start review" : "Open review"}
          </Link>
        </div>
      </div>
    </div>
  </div>
);
            })
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-6">
  <p className="text-lg font-semibold text-white">
    {queueOwner === "Truvern Review Team"
      ? "No Truvern Review Team reviews"
      : queueView === "released"
        ? "No released reviews found"
        : "No review assignments match this view"}
  </p>

  <p className="mt-2 max-w-2xl text-sm text-slate-400">
    {queueOwner === "Truvern Review Team"
      ? "Every visible review already has an owner. Clear the ownership filter to continue working the full queue."
      : "Try clearing filters, switching to All reviews, or searching by vendor, assignment, or request ID."}
  </p>

  <div className="mt-4 flex flex-wrap gap-3">
    {queueOwner !== "all" ||
    queueType !== "all" ||
    q ||
    queueSort !== "priority" ? (
      <Link
        href={`/review-desk?view=${queueView}`}
        className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.09]"
      >
        Clear filters
      </Link>
    ) : null}

    {queueView !== "all" ? (
      <Link
  href={queueUrl("all", q, queueType, queueOwner, queueSort)}
  className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/20"
>
  View all reviews
</Link>
    ) : null}
  </div>
</div>
                    )}
        </div>
      </ReviewQueueBulkProvider>
      </section>

      {!vendor ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-slate-300">
            Open a vendor review, collect responses, track evidence, or upgrade to Pro to unlock advanced governance operations.
          </p>
        </div>
      ) : (
        <div id="review-workspace" className="mt-8 scroll-mt-28 space-y-6">
          <section className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-950/40">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
                  Review intake
                </p>

                <h2 className="mt-3 text-4xl font-semibold text-white">
                  {vendor.name}
                </h2>

                <p className="mt-3 text-slate-300">
                  Ready for governance review intake, assignment, Truvern expert
                  review, and release workflow.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                    Vendor #{vendor.id}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                    {vendor.category ?? "Uncategorized"}
                  </div>

                  {assignment ? (
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
                      Assignment #{assignment.id}
                    </div>
                  ) : null}
                </div>
              </div>

              {assignment ? (
                <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-50">
                  <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">
                    Current review workflow
                  </p>
                  <p className="mt-2 font-semibold text-white">
                    {upper(latestOutcomeResponses?.releaseState) ===
                      "RELEASED" ||
                    upper(latestOutcomeResponses?.intent) === "RELEASE"
                      ? "Review outcome released"
                      : upper(latestOutcomeResponses?.intent) === "COMPLETE"
                        ? "Review completed"
                        : upper(assignment.status) === "IN_PROGRESS"
                          ? "Review in progress"
                          : `Review assignment #${assignment.id} exists`}
                  </p>
                  <p className="mt-1 text-slate-300">
                    Assignment #{assignment.id} ·{" "}
                    {upper(latestOutcomeResponses?.releaseState) ===
                      "RELEASED" ||
                    upper(latestOutcomeResponses?.intent) === "RELEASE"
                      ? "RELEASED"
                      : upper(latestOutcomeResponses?.intent) === "COMPLETE"
                        ? "COMPLETED"
                        : upper(assignment.status) || "OPEN"}
                  </p>
                </div>
              ) : (
                <ReviewDeskSubmissionActions
                    vendorId={vendor.id}
                    creditBalance={orgCreditBalance}
                    analysts={analystOptions}
                  />
              )}
            </div>
          </section>

          {assignment ? (
<ReviewAssignmentWorkspace
              canManageTruvernReview={canManageTruvernReview}
              vendor={{
                id: vendor.id,
                name: vendor.name,
                category: vendor.category,
              }}
              assignment={{
                id: Number(assignment.id),
                status: upper(assignment.status) || "OPEN",
                assignmentType:
                  upper(assignment.assignmentType) ||
                  upper(assignment.type) ||
                  (mode === "truvern" ? "TRUVERN" : "INTERNAL"),
                assignedReviewerName:
                  safeStr(assignment.assignedReviewerName) ||
                  safeStr(assignment.reviewerName) ||
                  safeStr(assignment.assignedTo) ||
                  (
  upper(assignment.assignmentType) === "TRUVERN"
    ? "Truvern expert"
    : assignment.reviewerUserId
      ? "Internal reviewer"
                    : "Truvern Review Team"),
                createdAt: iso(assignment.createdAt),
                updatedAt: iso(assignment.updatedAt),
              }}
              request={{
                id: requestId,
                status: upper(request?.status) || "OPEN",
              }}
              evidenceSummary={{
                totalEvidence: evidenceCount,
                pendingRequests: pendingEvidenceRequests,
                completedRequests: completedEvidenceRequests,
                openRemediationRequests,
                approvedRemediationRequests,
                releaseBlocked: openRemediationRequests > 0,
              }}
              latestOutcome={{
                id: latestOutcome?.id ? Number(latestOutcome.id) : null,
                status: upper(latestOutcomeResponses?.intent) || "DRAFT",
                decision: safeStr(latestOutcomeResponses?.decision) || null,
                riskLevel: safeStr(latestOutcomeResponses?.riskLevel) || null,
                releaseState:
                  safeStr(latestOutcomeResponses?.releaseState) || null,
                findings:
  safeStr(latestOutcomeResponses?.findings) ||
  safeStr(latestOutcomeResponses?.summary) ||
  safeStr(latestOutcomeResponses?.executiveSummary) ||
  "",

updatedAt: iso(latestOutcome?.updatedAt),

generatedDraft: {
  schema: safeStr(latestOutcomeResponses?.schema),
  generatedAt:
    iso(latestOutcomeResponses?.generatedAt) ||
    iso(latestOutcome?.createdAt),
  summary:
    safeStr(latestOutcomeResponses?.summary) ||
    safeStr(latestOutcomeResponses?.executiveSummary) ||
    safeStr(latestOutcomeResponses?.findings),
  recommendations:
    Array.isArray(latestOutcomeResponses?.recommendations)
      ? latestOutcomeResponses.recommendations
      : [],
  structuredAssessment:
    latestOutcomeResponses?.structuredAssessment &&
    typeof latestOutcomeResponses.structuredAssessment === "object"
      ? latestOutcomeResponses.structuredAssessment
      : null,
},
              }}
              auditEvents={[
  {
    label: "Assignment created",
    at: iso(assignment.createdAt),
    detail:
      "Review assignment was created from Governance Ops intake.",
  },

  ...creditLedgerRows.map((entry) => ({
    label:
      upper(entry.entryType) === "RESERVATION"
        ? "Credit reserved"
        : upper(entry.entryType) === "CONSUMPTION"
          ? "Credit consumed"
          : upper(entry.entryType) === "REVERSAL"
            ? "Credit reservation reversed"
            : `Credit ledger ${upper(entry.entryType) || "ENTRY"}`,

    at: iso(entry.createdAt),

    detail:
      entry.note ||
      `Available ${entry.availableDelta}, reserved ${entry.reservedDelta}, consumed ${entry.consumedDelta}.`,
  })),

  {
    label: "Review started",
    at: iso(assignment.startedAt),
    detail: "Reviewer activity began on this assignment.",
  },

  {
    label: "Draft saved",
    at: iso(latestOutcome?.draftSavedAt),
    detail:
      "Findings and outcome fields were saved as a draft.",
  },

  {
    label: "Review submitted",
    at: iso(latestOutcome?.submittedAt ?? assignment.submittedAt),
    detail: "Review was marked complete or released.",
  },

  {
    label: "Outcome released",
    at: iso(latestOutcomeResponses?.releasedAt),
    detail: "Governance outcome was released and locked.",
  },

  {
    label: "Governance confirmed",
    at: iso(latestOutcomeResponses?.confirmedAt),
    detail:
      "Released outcome was confirmed for audit closeout.",
  },

  {
    label: "Governance seal generated",
    at: iso(latestOutcomeResponses?.governanceSeal?.sealedAt),
    detail:
      "Immutable governance checksum, notarization receipt, and transparency ledger entry were generated.",
  },
]}
            />
          ) : mode ? (
            <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                Assignment selected
              </p>

              <h3 className="mt-3 text-2xl font-semibold text-white">
                {mode === "truvern"
                  ? "Truvern expert review requested"
                  : "Internal review started"}
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                Assignment initialization completed successfully.
              </p>
            </section>
          ) : null}
        </div>
      )}
    
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
          Workflow Operations
        </p>

        <h2 className="mt-3 text-2xl font-semibold text-white">
          Review queues and task operations
        </h2>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="/review-desk/workflow-queue"
            className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20"
          >
            Open Workflow Queue
          </a>

          <a
            href="/review-desk/tasks"
            className="rounded-2xl border border-indigo-300/25 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-400/20"
          >
            Open Task Queue
          </a>
        </div>
      </section>

    </main>
  );
}










































































































































