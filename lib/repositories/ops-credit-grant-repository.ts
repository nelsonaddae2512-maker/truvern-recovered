import prisma from "@/lib/prisma";

export type OpsCreditGrantOrganizationRow = {
  id: number;
  name: string | null;
};

export type OpsCreditBalanceRow = {
  availableCredits: number;
  reservedCredits: number;
  consumedCredits: number;
};

export async function readOpsCreditGrantOrganization(
  organizationId: number,
): Promise<OpsCreditGrantOrganizationRow[]> {
  return prisma.$queryRaw<OpsCreditGrantOrganizationRow[]>`
    select id, name
    from "Organization"
    where id = ${organizationId}
    limit 1
  `;
}

export async function insertOpsCreditGrant(input: {
  organizationId: number;
  credits: number;
  reason: string;
  eventKey: string;
}) {
  return prisma.$executeRaw`
    insert into "TruvernCreditLedgerEntry" (
      "organizationId",
      "entryType",
      "status",
      "fundingSource",
      "availableDelta",
      "reservedDelta",
      "consumedDelta",
      "quantity",
      "reason",
      "note",
      "eventKey",
      "createdAt",
      "updatedAt"
    )
    values (
      ${input.organizationId},
      'GRANT'::"TruvernCreditEntryType",
      'POSTED'::text,
      'PROMOTIONAL'::"TruvernCreditFundingSource",
      ${input.credits},
      0,
      0,
      ${input.credits},
      ${input.reason},
      ${input.reason},
      ${input.eventKey},
      now(),
      now()
    )
  `;
}

export async function readOpsCreditBalance(
  organizationId: number,
): Promise<OpsCreditBalanceRow[]> {
  return prisma.$queryRaw<OpsCreditBalanceRow[]>`
    select
      coalesce(sum("availableDelta"), 0)::int as "availableCredits",
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
      coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = ${organizationId}
  `;
}