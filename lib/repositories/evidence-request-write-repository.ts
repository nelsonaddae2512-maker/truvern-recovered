import prisma from "@/lib/prisma";

export type EvidenceRequestInsertRow = {
  id: number;
};

export async function insertEvidenceRequest(input: {
  vendorId: number;
  organizationId: number;
  requestedBy: string;
  kind: string;
  title: string;
  dueAt: Date | string | null;
}): Promise<EvidenceRequestInsertRow[]> {
  return prisma.$queryRaw<EvidenceRequestInsertRow[]>`
    insert into "EvidenceRequest" (
      "vendorId",
      "organizationId",
      "requestedBy",
      kind,
      label,
      title,
      "dueAt",
      status,
      "createdAt",
      "updatedAt"
    )
    values (
      ${input.vendorId},
      ${input.organizationId},
      ${input.requestedBy},
      ${input.kind}::"EvidenceRequestKind",
      ${input.title},
      ${input.title},
      ${input.dueAt},
      'REQUESTED'::"EvidenceRequestStatus",
      now(),
      now()
    )
    returning id
  `;
}