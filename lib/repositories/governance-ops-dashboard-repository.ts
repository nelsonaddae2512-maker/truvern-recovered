import prisma from "@/lib/prisma";

export type GovernanceOpsPortfolioRow = {
  vendorId: number;
  vendorName: string | null;
  latestScore: number | null;
  previousScore: number | null;
  remediationCount: number | null;
  missingEvidenceCount: number | null;
  breachDisclosureDetected: boolean | null;
  federalInvestigationDetected: boolean | null;
};

export type GovernanceOpsCreditBalanceRow = {
  availableCredits: number;
  reservedCredits: number;
  consumedCredits: number;
  effectiveCredits: number;
};

export type GovernanceOpsAnalystRow = {
  userId: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
};

export async function readGovernanceOpsPortfolioMemory(
  organizationId: number,
): Promise<GovernanceOpsPortfolioRow[]> {
  return prisma.$queryRaw<GovernanceOpsPortfolioRow[]>`
    with ranked as (
      select
        vgm.*,
        v.name as "vendorName",
        row_number() over (
          partition by vgm."vendorId"
          order by vgm."createdAt" desc
        ) as rn
      from "VendorGovernanceMemory" vgm
      join "Vendor" v
        on v.id = vgm."vendorId"
      where v."organizationId" = ${organizationId}
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
  `;
}

export async function readGovernanceOpsVendorCreditBalance(
  vendorId: number,
): Promise<GovernanceOpsCreditBalanceRow[]> {
  return prisma.$queryRaw<GovernanceOpsCreditBalanceRow[]>`
    select
      coalesce(
        sum(l."availableDelta"),
        0
      )::int as "availableCredits",
      coalesce(
        sum(l."reservedDelta"),
        0
      )::int as "reservedCredits",
      coalesce(
        sum(l."consumedDelta"),
        0
      )::int as "consumedCredits",
      (
        coalesce(
          sum(l."availableDelta"),
          0
        ) -
        coalesce(
          sum(l."reservedDelta"),
          0
        )
      )::int as "effectiveCredits"
    from "Vendor" v
    left join "TruvernCreditLedgerEntry" l
      on l."organizationId" = v."organizationId"
      and l.status::text = 'POSTED'
    where v.id::text = ${String(vendorId)}::text
  `;
}

export async function readGovernanceOpsVendorAnalysts(
  vendorId: number,
): Promise<GovernanceOpsAnalystRow[]> {
  return prisma.$queryRaw<GovernanceOpsAnalystRow[]>`
    select
      u.id::text as "userId",
      coalesce(
        u.name,
        u.email,
        'Internal analyst'
      )::text as name,
      u.email::text as email,
      m.role::text as role
    from "Vendor" v
    join "OrgMembership" m
      on m."organizationId"::text =
         v."organizationId"::text
    join "User" u
      on u.id::text =
         m."userId"::text
    where v.id::text = ${String(vendorId)}::text
      and m.role::text in (
        'OWNER',
        'ADMIN',
        'ANALYST'
      )
      and u.id is not null
    order by coalesce(
      u.name,
      u.email
    ) asc
  `;
}