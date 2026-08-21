import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type EvidenceClient = Pick<
  Prisma.TransactionClient,
  "evidence"
>;

export async function findEvidence<
  T extends Prisma.EvidenceFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.EvidenceFindManyArgs
  >,
  client: EvidenceClient = prisma,
): Promise<
  Prisma.EvidenceGetPayload<T>[]
> {
  return client.evidence.findMany(args);
}
