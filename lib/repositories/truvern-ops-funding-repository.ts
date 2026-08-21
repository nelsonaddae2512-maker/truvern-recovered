import prisma from "@/lib/prisma";

export async function readFundingOrganization(
  organizationId: number,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select *
    from "Organization"
    where id = ${organizationId}
    limit 1
  `;
}

export async function readFundingPlanOverride(
  organizationId: number,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select *
    from "OrganizationPlanOverride"
    where "organizationId" = ${organizationId}
      and "revokedAt" is null
    order by "createdAt" desc, id desc
    limit 1
  `;
}

export async function readFundingLedgerEntries(
  organizationId: number,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select *
    from "TruvernCreditLedgerEntry"
    where "organizationId" = ${organizationId}
    order by "createdAt" desc, id desc
    limit 100
  `;
}

export async function readFundingCreditBalance(
  organizationId: number,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      coalesce(sum("availableDelta"), 0)::int as "availableCredits",
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
      coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = ${organizationId}
  `;
}