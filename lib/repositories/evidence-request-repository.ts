import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type EvidenceRequestClient = Pick<
  Prisma.TransactionClient,
  "evidenceRequest"
>;

export async function findEvidenceRequest<
  T extends Prisma.EvidenceRequestFindUniqueArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.EvidenceRequestFindUniqueArgs
  >,
  client: EvidenceRequestClient = prisma,
): Promise<
  Prisma.EvidenceRequestGetPayload<T> | null
> {
  return client.evidenceRequest.findUnique(args);
}

export async function updateEvidenceRequest<
  T extends Prisma.EvidenceRequestUpdateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.EvidenceRequestUpdateArgs
  >,
  client: EvidenceRequestClient = prisma,
): Promise<
  Prisma.EvidenceRequestGetPayload<T>
> {
  return client.evidenceRequest.update(args);
}
export async function findEvidenceRequests<
  T extends Prisma.EvidenceRequestFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.EvidenceRequestFindManyArgs
  >,
  client: EvidenceRequestClient = prisma,
): Promise<
  Prisma.EvidenceRequestGetPayload<T>[]
> {
  return client.evidenceRequest.findMany(args);
}
export async function createEvidenceRequest<
  T extends Prisma.EvidenceRequestCreateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.EvidenceRequestCreateArgs
  >,
  client: EvidenceRequestClient = prisma,
): Promise<
  Prisma.EvidenceRequestGetPayload<T>
> {
  return client.evidenceRequest.create(args);
}