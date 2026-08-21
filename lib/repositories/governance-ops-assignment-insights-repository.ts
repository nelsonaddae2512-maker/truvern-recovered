import prisma from "@/lib/prisma";

export type VendorGovernanceMemoryRow = {
  governanceScore: number | null;
  governanceDecision: string | null;
  residualRisk: string | null;
  criticalFailures: number | null;
  partialControls: number | null;
  missingEvidenceCount: number | null;
  remediationCount: number | null;
  breachDisclosureDetected: boolean | null;
  federalInvestigationDetected: boolean | null;
  governanceNarrative: string | null;
  createdAt: string | Date | null;
};

export type ReviewCreditLedgerRow = {
  entryType: string;
  availableDelta: number;
  reservedDelta: number;
  consumedDelta: number;
  quantity: number;
  note: string | null;
  createdAt: Date | string | null;
};

export async function readVendorGovernanceMemory(
  vendorId: number,
): Promise<VendorGovernanceMemoryRow[]> {
  return prisma.$queryRaw<VendorGovernanceMemoryRow[]>`
    select
      "governanceScore",
      "governanceDecision",
      "residualRisk",
      "criticalFailures",
      "partialControls",
      "missingEvidenceCount",
      "remediationCount",
      "breachDisclosureDetected",
      "federalInvestigationDetected",
      "governanceNarrative",
      "createdAt"
    from "VendorGovernanceMemory"
    where "vendorId" = ${vendorId}
    order by "createdAt" desc
    limit 12
  `;
}

export async function readPostedReviewCreditLedger(
  reviewAssignmentId: number,
): Promise<ReviewCreditLedgerRow[]> {
  return prisma.$queryRaw<ReviewCreditLedgerRow[]>`
    select
      "entryType"::text as "entryType",
      "availableDelta",
      "reservedDelta",
      "consumedDelta",
      quantity,
      note,
      "createdAt"
    from "TruvernCreditLedgerEntry"
    where "reviewAssignmentId" = ${reviewAssignmentId}
      and status = 'POSTED'::text
    order by "createdAt" asc, id asc
  `;
}