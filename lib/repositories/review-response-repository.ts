import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function findLatestReviewResponse(
  reviewAssignmentId: number,
) {
  return prisma.reviewResponse.findFirst({
    where: {
      reviewAssignmentId,
    },
    select: {
      id: true,
      responses: true,
      draftSavedAt: true,
      submittedAt: true,
      updatedAt: true,
    },
    orderBy: [
      { updatedAt: "desc" },
      { id: "desc" },
    ],
  });
}
type ReviewResponseClient = Pick<
  Prisma.TransactionClient,
  "reviewResponse"
>;

export async function updateReviewResponse(
  input: {
    id: number;
    data: Prisma.ReviewResponseUpdateInput;
    select?: Prisma.ReviewResponseSelect;
  },
  client: ReviewResponseClient = prisma,
) {
  return client.reviewResponse.update({
    where: {
      id: input.id,
    },
    data: input.data,
    ...(input.select
      ? {
          select: input.select,
        }
      : {}),
  });
}
export async function createReviewResponse(
  input: {
    data: Prisma.ReviewResponseCreateInput;
    select?: Prisma.ReviewResponseSelect;
  },
  client: ReviewResponseClient = prisma,
) {
  return client.reviewResponse.create({
    data: input.data,
    ...(input.select
      ? {
          select: input.select,
        }
      : {}),
  });
}