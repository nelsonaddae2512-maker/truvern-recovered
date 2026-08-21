import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type GovernanceTransparencyLogClient = Pick<
  Prisma.TransactionClient,
  "governanceTransparencyLog"
>;

export async function findGovernanceTransparencyLogs<
  T extends Prisma.GovernanceTransparencyLogFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.GovernanceTransparencyLogFindManyArgs
  >,
  client: GovernanceTransparencyLogClient = prisma,
): Promise<
  Prisma.GovernanceTransparencyLogGetPayload<T>[]
> {
  return client.governanceTransparencyLog.findMany(args);
}

export async function findFirstGovernanceTransparencyLog<
  T extends Prisma.GovernanceTransparencyLogFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.GovernanceTransparencyLogFindFirstArgs
  >,
  client: GovernanceTransparencyLogClient = prisma,
): Promise<
  Prisma.GovernanceTransparencyLogGetPayload<T> | null
> {
  return client.governanceTransparencyLog.findFirst(args);
}
