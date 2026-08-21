import prisma from "@/lib/prisma";

export type BillingCreditBalanceRow = {
  availableCredits: number;
  reservedCredits: number;
  consumedCredits: number;
  effectiveCredits: number;
};

export type BillingCreditLedgerRow = {
  id: number;
  entryType: string | null;
  fundingSource: string | null;
  note: string | null;
  availableDelta: number | null;
  reservedDelta: number | null;
  consumedDelta: number | null;
  createdAt: string | Date | null;
  status: string | null;
  metadataJson: any;
};

export async function readBillingCreditBalance(
  organizationId: number,
): Promise<BillingCreditBalanceRow[]> {
  return prisma.$queryRaw<BillingCreditBalanceRow[]>`
    select
      coalesce(sum("availableDelta"), 0)::int as "availableCredits",
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
      coalesce(sum("consumedDelta"), 0)::int as "consumedCredits",
      (
        coalesce(sum("availableDelta"), 0)
        + coalesce(sum("reservedDelta"), 0)
        - coalesce(sum("consumedDelta"), 0)
      )::int as "effectiveCredits"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = ${organizationId}
  `;
}

export async function readBillingCreditLedgerActivity(
  organizationId: number,
): Promise<BillingCreditLedgerRow[]> {
  return prisma.$queryRaw<BillingCreditLedgerRow[]>`
    select
      id,
      "entryType"::text as "entryType",
      "fundingSource"::text as "fundingSource",
      note,
      "availableDelta",
      "reservedDelta",
      "consumedDelta",
      status::text as status,
      "metadataJson",
      "createdAt"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = ${organizationId}
    order by "createdAt" desc, id desc
    limit 12
  `;
}