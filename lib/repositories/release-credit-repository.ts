import prisma from "@/lib/prisma";

export async function readExistingCreditConsumption(
  eventKey: string,
): Promise<Array<{ count: number }>> {
  return prisma.$queryRaw<Array<{ count: number }>>`
    select count(*)::int as count
    from "TruvernCreditLedgerEntry"
    where "eventKey" = ${eventKey}
      and status = 'POSTED'::text
  `;
}

export async function readReservedCreditBalance(
  organizationId: number,
  assignmentId: number,
): Promise<Array<{ reservedCredits: number }>> {
  return prisma.$queryRaw<Array<{ reservedCredits: number }>>`
    select
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = ${organizationId}
      and "reviewAssignmentId" = ${assignmentId}
      and status = 'POSTED'::text
  `;
}

export async function insertCreditConsumptionLedgerEntry(input: {
  organizationId: number;
  assignmentId: number;
  eventKey: string;
  reservedCredits: number;
  note: string;
  metadataJson: string;
}): Promise<void> {
  await prisma.$executeRaw`
    insert into "TruvernCreditLedgerEntry" (
      "organizationId",
      "reviewAssignmentId",
      "eventKey",
      "entryType",
      "fundingSource",
      status,
      "availableDelta",
      "reservedDelta",
      "consumedDelta",
      quantity,
      note,
      "metadataJson",
      "createdAt"
    )
    select
      ${input.organizationId},
      ${input.assignmentId},
      ${input.eventKey},
      'CONSUMPTION'::text,
      'PREPAID_CREDITS'::text,
      'POSTED'::text,
      0,
      ${-input.reservedCredits},
      ${input.reservedCredits},
      ${input.reservedCredits},
      ${input.note},
      ${input.metadataJson}::jsonb,
      now()
    where not exists (
      select 1
      from "TruvernCreditLedgerEntry"
      where "eventKey" = ${input.eventKey}
    )
  `;
}