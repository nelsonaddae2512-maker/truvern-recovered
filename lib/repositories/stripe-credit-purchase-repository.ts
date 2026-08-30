import prisma from "@/lib/prisma";

export type StripeCreditEventCountRow = {
  count: number;
};

export async function countStripeCreditEntriesByEventKey(
  eventKey: string,
): Promise<StripeCreditEventCountRow[]> {
  return prisma.$queryRaw<StripeCreditEventCountRow[]>`
    select count(*)::int as count
    from "TruvernCreditLedgerEntry"
    where "eventKey" = ${eventKey}
  `;
}

export async function insertStripeCreditPurchase(input: {
  organizationId: number;
  userId: string;
  eventKey: string;
  credits: number;
  note: string;
  metadataJson: string;
}) {
  return prisma.$executeRaw`
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
    values (
      ${input.organizationId},
      null,
      ${input.eventKey},
      'PURCHASE'::text,
      'PREPAID_CREDITS'::text,
      'POSTED'::text,
      ${input.credits},
      0,
      0,
      ${input.credits},
      ${input.note},
      ${input.metadataJson}::jsonb,
      now()
    )
    on conflict ("eventKey") do nothing
  `;
}