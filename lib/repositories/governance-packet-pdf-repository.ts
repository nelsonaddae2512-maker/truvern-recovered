import prisma from "@/lib/prisma";

export type GovernancePacketJson =
  Record<string, any>;

export type GovernancePacketAssignmentRow = {
  assignmentId: number;
  assignmentStatus: any;
  responses: GovernancePacketJson | null;
  outcomeUpdatedAt: Date | string | null;
  vendorId: number | null;
  vendorName: string | null;
  vendorCategory: string | null;

  // These are referenced by the legacy packet renderer but were
  // not selected by the historical query. Keep them optional so
  // the migration does not alter runtime behavior.
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type GovernancePacketEvidenceRow = {
  id: number;
  createdAt: Date | string | null;
  requestTitle: string | null;
};

export async function readGovernancePacketAssignment(
  assignmentId: number,
): Promise<GovernancePacketAssignmentRow[]> {
  return prisma.$queryRaw<GovernancePacketAssignmentRow[]>`
    select
      ra.id as "assignmentId",
      ra.status as "assignmentStatus",
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
}

export async function readGovernancePacketEvidence(
  vendorId: number,
): Promise<GovernancePacketEvidenceRow[]> {
  return prisma.$queryRaw<GovernancePacketEvidenceRow[]>`
    select
      e.id,
      e."createdAt",
      er.title as "requestTitle"
    from "Evidence" e
    left join "EvidenceRequest" er
      on er.id = e."evidenceRequestId"
    where e."vendorId" = ${vendorId}
    order by e."createdAt" asc
  `;
}