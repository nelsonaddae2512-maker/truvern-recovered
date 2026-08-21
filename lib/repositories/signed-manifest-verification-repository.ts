import prisma from "@/lib/prisma";

export type SignedManifestVerificationRow = {
  id: number;
  checksum: string | null;
  createdAt: Date;
  assignmentId: number;
  status: string;
  vendorName: string;
  vendorSlug: string | null;
};

export async function readSignedManifestVerification(
  manifestId: number,
): Promise<SignedManifestVerificationRow[]> {
  return prisma.$queryRaw<SignedManifestVerificationRow[]>`
    select
      gm.id,
      gm.checksum,
      gm."createdAt",
      ra.id as "assignmentId",
      ra.status::text as status,
      v.name as "vendorName",
      v.slug as "vendorSlug"
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