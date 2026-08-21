import prisma from "@/lib/prisma";

export type PublicReleaseVerificationRow = {
  manifestId: number;
  checksum: string | null;
  manifestCreatedAt: Date;
  assignmentId: number;
  assignmentStatus: string;
  vendorId: number;
  vendorName: string;
  vendorSlug: string | null;
  vendorCategory: string | null;
};

export async function readPublicReleaseVerification(
  manifestId: number,
): Promise<PublicReleaseVerificationRow[]> {
  return prisma.$queryRaw<PublicReleaseVerificationRow[]>`
    select
      gm.id as "manifestId",
      gm.checksum,
      gm."createdAt" as "manifestCreatedAt",
      ra.id as "assignmentId",
      ra.status::text as "assignmentStatus",
      v.id as "vendorId",
      v.name as "vendorName",
      v.slug as "vendorSlug",
      v.category as "vendorCategory"
    from "GovernanceReleaseManifest" gm
    join "ReviewAssignment" ra
      on ra.id = gm."reviewAssignmentId"
    join "ReviewRequest" rr
      on rr.id = ra."reviewRequestId"
    join "Vendor" v
      on v.id = rr."vendorId"
    where gm.id = ${manifestId}
    limit 1
  `;
}