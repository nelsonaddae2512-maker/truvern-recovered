import prisma from "@/lib/prisma";

export async function readOpsOrganizationCount(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select count(*)::int as "count"
    from "Organization"
  `;
}

export async function readOpsVendorCount(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select count(*)::int as "count"
    from "Vendor"
  `;
}

export async function readOpsReviewSummary(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
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
  `;
}

export async function readOpsCreditSummary(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      coalesce(sum("availableDelta"), 0)::int as "availableCredits",
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
      coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
    from "TruvernCreditLedgerEntry"
  `;
}

export async function readOpsActiveOverrides(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      opo.*,
      o.name as "organizationName"
    from "OrganizationPlanOverride" opo
    left join "Organization" o
      on o.id = opo."organizationId"
    where opo."revokedAt" is null
      and opo."startsAt" <= now()
      and (
        opo."expiresAt" is null
        or opo."expiresAt" > now()
      )
    order by opo."createdAt" desc, opo.id desc
    limit 8
  `;
}

export async function readOpsLowBalanceOrganizations(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
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
    ) c
      on c."organizationId" = o.id
    where coalesce(c."availableCredits", 0) <= 5
    order by coalesce(c."availableCredits", 0) asc, o."createdAt" desc
    limit 6
  `;
}