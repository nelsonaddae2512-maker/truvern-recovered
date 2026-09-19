import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type ReviewRequestClient = Pick<
  Prisma.TransactionClient,
  "reviewRequest"
>;

export async function createReviewRequest<
  T extends Prisma.ReviewRequestCreateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.ReviewRequestCreateArgs
  >,
  client: ReviewRequestClient = prisma,
): Promise<Prisma.ReviewRequestGetPayload<T>> {
  return client.reviewRequest.create(args);
}

export async function updateManyReviewRequest(
  args: Prisma.ReviewRequestUpdateManyArgs,
  client: ReviewRequestClient = prisma,
): Promise<Prisma.BatchPayload> {
  return client.reviewRequest.updateMany(args);
}
export async function findReviewRequest<
  T extends Prisma.ReviewRequestFindUniqueArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.ReviewRequestFindUniqueArgs
  >,
  client: ReviewRequestClient = prisma,
): Promise<
  Prisma.ReviewRequestGetPayload<T> | null
> {
  return client.reviewRequest.findUnique(args);
}