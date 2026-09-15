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
  const now = new Date();

  return client.evidenceRequest.update({
    where: {
      id: input.id,
    },
    data: {
      status:
        input.status as Prisma.EvidenceRequestUpdateInput["status"],
      reviewedAt:
        input.status === "APPROVED" ||
        input.status === "REJECTED"
          ? now
          : input.status === "REQUESTED"
            ? null
            : undefined,
      updatedAt: now,
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  });
}