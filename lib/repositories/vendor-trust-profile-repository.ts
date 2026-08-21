import prisma from "@/lib/prisma";

export type VendorTrustReleaseRow = {
  assignmentId: number;
  responseId: number;
  decision: string | null;
  riskLevel: string | null;
  confirmedAt: string | null;
  checksum: string | null;
  receiptId: string | null;
  entryId: number | null;
  entryHash: string | null;
  updatedAt: Date;
};

export async function readVendorTrustReleases(
  vendorId: number,
): Promise<VendorTrustReleaseRow[]> {
  return prisma.$queryRaw<VendorTrustReleaseRow[]>`
    select
      ra.id as "assignmentId",
      rr.id as "responseId",
      rr.responses->>'decision' as decision,
      rr.responses->>'riskLevel' as "riskLevel",
      rr.responses->>'confirmedAt' as "confirmedAt",
      rr.responses->'governanceSeal'->>'checksum' as checksum,
      coalesce(
        rr.responses->'governanceSeal'->>'receiptId',
        gtl."receiptId"
      ) as "receiptId",
      gtl.id as "entryId",
      gtl."entryHash" as "entryHash",
      rr."updatedAt" as "updatedAt"
    from "ReviewAssignment" ra
    join "ReviewResponse" rr
      on rr."reviewAssignmentId" = ra.id
    left join "GovernanceTransparencyLog" gtl
      on gtl."assignmentId" = ra.id
    where ra."vendorId" = ${vendorId}
      and upper(
        coalesce(
          rr.responses->>'releaseState',
          ''
        )
      ) in (
        'CONFIRMED',
        'RELEASED'
      )
    order by ra.id desc
    limit 20
  `;
}