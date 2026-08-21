import prisma from "@/lib/prisma";

export type OpsFundingOverviewRow = Record<string, any>;
export type OpsFundingPurchaseRow = Record<string, any>;

export async function readOpsFundingOverview(): Promise<
  OpsFundingOverviewRow[]
> {
  return prisma.$queryRaw<OpsFundingOverviewRow[]>`
    select
      o.id,
      o.name,
      o.slug,
      o."createdAt",
      count(distinct v.id)::int as "vendorCount",
      count(distinct ra.id)::int as "reviewCount",
      coalesce(c."availableCredits", 0)::int as "availableCredits",
      coalesce(c."reservedCredits", 0)::int as "reservedCredits",
      coalesce(c."consumedCredits", 0)::int as "consumedCredits",
      (
        coalesce(c."availableCredits", 0)
        + coalesce(c."reservedCredits", 0)
        - coalesce(c."consumedCredits", 0)
      )::int as "effectiveCredits"
    from "Organization" o
    left join "Vendor" v on v."organizationId" = o.id
    left join "ReviewRequest" rr on rr."vendorId" = v.id
    left join "ReviewAssignment" ra on ra."reviewRequestId" = rr.id
    left join (
      select
        "organizationId",
        coalesce(sum("availableDelta"), 0)::int as "availableCredits",
        coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
        coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
      from "TruvernCreditLedgerEntry"
      group by "organizationId"
    ) c on c."organizationId" = o.id
    group by
      o.id,
      c."availableCredits",
      c."reservedCredits",
      c."consumedCredits"
    order by o."createdAt" desc
    limit 100
  `;
}

export async function readOpsRecentCreditPurchases(): Promise<
  OpsFundingPurchaseRow[]
> {
  return prisma.$queryRaw<OpsFundingPurchaseRow[]>`
    select
      l.id,
      l."organizationId",
      o.name as "organizationName",
      l.quantity,
      l.note,
      l."createdAt"
    from "TruvernCreditLedgerEntry" l
    left join "Organization" o
      on o.id = l."organizationId"
    where l."entryType"::text = 'PURCHASE'
    order by l."createdAt" desc
    limit 10
  `;
}