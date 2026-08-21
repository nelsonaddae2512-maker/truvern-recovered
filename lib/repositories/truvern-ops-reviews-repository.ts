import prisma from "@/lib/prisma";

export async function readOpsReviewMetrics(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
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
  `;
}

export async function readOpsUnclaimedReviews(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
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
  `;
}

export async function readOpsReleaseReadyReviews(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
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
  `;
}

export async function readOpsRecentReviews(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
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
  `;
}

