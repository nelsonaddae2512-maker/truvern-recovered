import prisma from "@/lib/prisma";

export const OPS_FUNDING_PAGE_SIZE = 25;

export function normalizeOpsFundingPage(value: unknown): number {
  const raw = typeof value === "string" ? value : "";
  if (!/^[1-9]\d{0,5}$/.test(raw)) return 1;

  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : 1;
}

export type OpsFundingOverviewRow = Record<string, any>;
export type OpsFundingPurchaseRow = Record<string, any>;

export async function readOpsFundingOverview(page = 1): Promise<
  OpsFundingOverviewRow[]
> {
  const normalizedPage = normalizeOpsFundingPage(String(page));
  const offset = (normalizedPage - 1) * OPS_FUNDING_PAGE_SIZE;

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
    order by o."createdAt" desc, o.id desc
    limit ${OPS_FUNDING_PAGE_SIZE}
    offset ${offset}
  `;
}

export async function readOpsFundingPortfolioSummary() {
  const rows = await prisma.$queryRaw<Array<{
    organizations: number;
    availableCredits: number;
    totalReviews: number;
    lowBalanceOrganizations: number;
  }>>`
    with credit_balances as (
      select
        "organizationId",
        coalesce(sum("availableDelta"), 0)::int as "availableCredits"
      from "TruvernCreditLedgerEntry"
      group by "organizationId"
    ),
    review_counts as (
      select
        v."organizationId",
        count(distinct ra.id)::int as "reviewCount"
      from "Vendor" v
      join "ReviewRequest" rr on rr."vendorId" = v.id
      join "ReviewAssignment" ra on ra."reviewRequestId" = rr.id
      group by v."organizationId"
    )
    select
      count(o.id)::int as "organizations",
      coalesce(sum(coalesce(c."availableCredits", 0)), 0)::int
        as "availableCredits",
      coalesce(sum(coalesce(r."reviewCount", 0)), 0)::int
        as "totalReviews",
      count(o.id) filter (
        where coalesce(c."availableCredits", 0) <= 5
      )::int as "lowBalanceOrganizations"
    from "Organization" o
    left join credit_balances c on c."organizationId" = o.id
    left join review_counts r on r."organizationId" = o.id
  `;

  return rows[0] ?? {
    organizations: 0,
    availableCredits: 0,
    totalReviews: 0,
    lowBalanceOrganizations: 0,
  };
}

export async function readOpsFundingLowBalanceOrganizations() {
  return prisma.$queryRaw<OpsFundingOverviewRow[]>`
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
    order by coalesce(c."availableCredits", 0) asc, o.id asc
    limit 5
  `;
}

export async function readOpsFundingHighConsumptionOrganizations() {
  return prisma.$queryRaw<OpsFundingOverviewRow[]>`
    select
      o.id,
      o.name,
      coalesce(c."consumedCredits", 0)::int as "consumedCredits"
    from "Organization" o
    left join (
      select
        "organizationId",
        coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
      from "TruvernCreditLedgerEntry"
      group by "organizationId"
    ) c on c."organizationId" = o.id
    order by coalesce(c."consumedCredits", 0) desc, o.id asc
    limit 5
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