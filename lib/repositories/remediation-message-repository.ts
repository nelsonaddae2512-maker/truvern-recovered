import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type RemediationMessageClient = Pick<
  Prisma.TransactionClient,
  "remediationMessage"
>;

export async function findRemediationMessages<
  T extends Prisma.RemediationMessageFindManyArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.RemediationMessageFindManyArgs>,
  client: RemediationMessageClient = prisma,
): Promise<Prisma.RemediationMessageGetPayload<T>[]> {
  return client.remediationMessage.findMany(args);
}

export async function createRemediationMessage<
  T extends Prisma.RemediationMessageCreateArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.RemediationMessageCreateArgs>,
  client: RemediationMessageClient = prisma,
): Promise<Prisma.RemediationMessageGetPayload<T>> {
  return client.remediationMessage.create(args);
}