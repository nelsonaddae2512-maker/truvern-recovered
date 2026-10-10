import prisma from "@/lib/prisma";

export const OPS_NETWORK_PAGE_SIZE = 25;

export function normalizeOpsNetworkPage(value: unknown): number {
  const raw = typeof value === "string" ? value : "";
  if (!/^[1-9]\d{0,5}$/.test(raw)) return 1;

  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : 1;
}

export async function readOpsNetworkProofMetrics(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
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
  `;
}

export async function readOpsNetworkOrganizations(
  page = 1,
  organizationId?: number,
): Promise<any[]> {
  const normalizedPage = normalizeOpsNetworkPage(String(page));
  const offset = (normalizedPage - 1) * OPS_NETWORK_PAGE_SIZE;

  if (
    organizationId !== undefined &&
    (!Number.isSafeInteger(organizationId) ||
      organizationId <= 0 ||
      organizationId > 2147483647)
  ) {
    return [];
  }
  return prisma.$queryRaw<any[]>`
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

    where (
      ${organizationId ?? null}::int is null
      or o.id = ${organizationId ?? null}::int
    )

    order by
      coalesce(reviews."unclaimedTruvernReviews", 0) desc,
      coalesce(reviews."releaseReadyReviews", 0) desc,
      coalesce(credits."availableCredits", 0) asc,
      "lastActivityAt" desc,
      o.id asc
    limit ${OPS_NETWORK_PAGE_SIZE}
    offset ${offset}
  `;
}
export async function readOpsNetworkPortfolioTotals() {
  const rows = await prisma.$queryRaw<
    Array<{
      organizations: number;
      vendors: number;
      truvernReviews: number;
      unclaimed: number;
      releaseReady: number;
      lowBalance: number;
    }>
  >`
    select
      count(*)::int as "organizations",
      coalesce(sum(coalesce(vendors."vendorCount", 0)), 0)::int as "vendors",
      coalesce(sum(coalesce(reviews."truvernReviews", 0)), 0)::int as "truvernReviews",
      coalesce(sum(coalesce(reviews."unclaimedTruvernReviews", 0)), 0)::int as "unclaimed",
      coalesce(sum(coalesce(reviews."releaseReadyReviews", 0)), 0)::int as "releaseReady",
      count(*) filter (
        where coalesce(credits."availableCredits", 0) <= 5
      )::int as "lowBalance"
    from "Organization" o
    left join (
      select "organizationId", count(*)::int as "vendorCount"
      from "Vendor"
      group by "organizationId"
    ) vendors on vendors."organizationId" = o.id
    left join (
      select
        "organizationId",
        coalesce(sum("availableDelta"), 0)::int as "availableCredits"
      from "TruvernCreditLedgerEntry"
      where status = 'POSTED'::text
      group by "organizationId"
    ) credits on credits."organizationId" = o.id
    left join (
      select
        ra."organizationId",
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
        )::int as "releaseReadyReviews"
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
  `;

  return rows[0] ?? {
    organizations: 0,
    vendors: 0,
    truvernReviews: 0,
    unclaimed: 0,
    releaseReady: 0,
    lowBalance: 0,
  };
}