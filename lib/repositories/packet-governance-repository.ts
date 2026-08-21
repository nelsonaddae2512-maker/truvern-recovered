import prisma from "@/lib/prisma";

export type GovernancePacketRow = {
  assignmentId: number;
  assignmentStatus: string;
  assignmentUpdatedAt: Date | null;

  responses: any;

  outcomeUpdatedAt: Date | null;

  vendorId: number | null;
  vendorName: string | null;
  vendorCategory: string | null;

  // Preserve the effective legacy `any[]` contract used by the
  // packet pages. Several optional/fallback properties are read
  // even when they are not projected by every query version.
  [key: string]: any;
};

export type PacketEvidenceRow = {
  id: number;
  name: string;
  createdAt: Date;
  status: string;
  fileKey: string | null;
  requestTitle: string | null;

  [key: string]: any;
};

export async function findGovernancePacketRow(
  assignmentId: number,
): Promise<GovernancePacketRow | null> {
  const rows = await prisma.$queryRaw<GovernancePacketRow[]>`
    select
      ra.id as "assignmentId",
      ra.status as "assignmentStatus",
      ra."updatedAt" as "assignmentUpdatedAt",
      rr.responses,
      rr."updatedAt" as "outcomeUpdatedAt",
      v.id as "vendorId",
      v.name as "vendorName",
      v.category as "vendorCategory"
    from "ReviewAssignment" ra
    left join "ReviewResponse" rr
      on rr."reviewAssignmentId" = ra.id
    left join "ReviewRequest" req
      on req.id = ra."reviewRequestId"
    left join "Vendor" v
      on v.id = req."vendorId"
    where ra.id = ${assignmentId}
    order by rr."updatedAt" desc nulls last
    limit 1
  `;

  return rows[0] ?? null;
}

export async function findPacketEvidenceForVendor(
  vendorId: number,
): Promise<PacketEvidenceRow[]> {
  return prisma.$queryRaw<PacketEvidenceRow[]>`
    select
      e.id,
      'Evidence artifact' as name,
      e."createdAt",
      'RECEIVED' as status,
      null::text as "fileKey",
      er.title as "requestTitle"
    from "Evidence" e
    left join "EvidenceRequest" er
      on er.id = e."evidenceRequestId"
    where e."vendorId" = ${vendorId}
    order by e."createdAt" asc
  `;
}