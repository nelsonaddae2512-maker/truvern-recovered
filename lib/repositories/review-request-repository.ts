import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type ReviewRequestClient = Pick<
  Prisma.TransactionClient,
  "reviewRequest"
>;

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