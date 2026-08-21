import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type EvidenceRequestReviewClient = Pick<
  Prisma.TransactionClient,
  "evidenceRequest"
>;

export async function updateEvidenceRequestReviewStatus(
  input: {
    id: number;
    status: string;
  },
  client: EvidenceRequestReviewClient = prisma,
) {
  return client.evidenceRequest.update({
    where: {
      id: input.id,
    },
    data: {
      status:
        input.status as Prisma.EvidenceRequestUpdateInput["status"],
      updatedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  });
}