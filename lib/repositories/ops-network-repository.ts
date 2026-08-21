import prisma from "@/lib/prisma";

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

export async function readOpsNetworkOrganizations(): Promise<any[]> {
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

    order by
      coalesce(reviews."unclaimedTruvernReviews", 0) desc,
      coalesce(reviews."releaseReadyReviews", 0) desc,
      coalesce(credits."availableCredits", 0) asc,
      "lastActivityAt" desc
    limit 100
  `;
}