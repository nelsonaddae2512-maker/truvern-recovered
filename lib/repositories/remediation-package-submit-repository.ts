import prisma from "@/lib/prisma";

export type SubmittedRemediationPackageRow = {
  id: number;
  evidenceRequestId: number | null;
};

export async function submitRemediationPackage(
  packageId: number,
): Promise<SubmittedRemediationPackageRow[]> {
  return prisma.$queryRaw<SubmittedRemediationPackageRow[]>`
    update "RemediationPackage"
    set
      status = 'SUBMITTED',
      "updatedAt" = now()
    where id = ${packageId}
    returning id, "evidenceRequestId"
  `;
}

export async function submitLinkedEvidenceRequest(
  evidenceRequestId: number,
): Promise<void> {
  await prisma.$executeRaw`
    update "EvidenceRequest"
    set
      status = 'SUBMITTED'::"EvidenceRequestStatus",
      "updatedAt" = now()
    where id = ${evidenceRequestId}
  `;
}