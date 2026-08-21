import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type GovernanceTransparencyCheckpointClient = Pick<
  Prisma.TransactionClient,
  "governanceTransparencyCheckpoint"
>;

export async function findGovernanceTransparencyCheckpoints<
  T extends Prisma.GovernanceTransparencyCheckpointFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.GovernanceTransparencyCheckpointFindManyArgs
  >,
  client: GovernanceTransparencyCheckpointClient = prisma,
): Promise<
  Prisma.GovernanceTransparencyCheckpointGetPayload<T>[]
> {
  return client.governanceTransparencyCheckpoint.findMany(args);
}

export async function findFirstGovernanceTransparencyCheckpoint<
  T extends Prisma.GovernanceTransparencyCheckpointFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.GovernanceTransparencyCheckpointFindFirstArgs
  >,
  client: GovernanceTransparencyCheckpointClient = prisma,
): Promise<
  Prisma.GovernanceTransparencyCheckpointGetPayload<T> | null
> {
  return client.governanceTransparencyCheckpoint.findFirst(args);
}
