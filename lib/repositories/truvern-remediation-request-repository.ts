import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type TruvernRemediationRequestClient = Pick<
  Prisma.TransactionClient,
  "truvernRemediationRequest"
>;

export async function findFirstTruvernRemediationRequest<
  T extends Prisma.TruvernRemediationRequestFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernRemediationRequestFindFirstArgs
  >,
  client: TruvernRemediationRequestClient = prisma,
): Promise<
  Prisma.TruvernRemediationRequestGetPayload<T> | null
> {
  return client.truvernRemediationRequest.findFirst(args);
}

export async function countTruvernRemediationRequests(
  args: Prisma.TruvernRemediationRequestCountArgs,
  client: TruvernRemediationRequestClient = prisma,
) {
  return client.truvernRemediationRequest.count(args);
}

export async function updateTruvernRemediationRequest<
  T extends Prisma.TruvernRemediationRequestUpdateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernRemediationRequestUpdateArgs
  >,
  client: TruvernRemediationRequestClient = prisma,
): Promise<
  Prisma.TruvernRemediationRequestGetPayload<T>
> {
  return client.truvernRemediationRequest.update(args);
}

export async function createTruvernRemediationRequest<
  T extends Prisma.TruvernRemediationRequestCreateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernRemediationRequestCreateArgs
  >,
  client: TruvernRemediationRequestClient = prisma,
): Promise<
  Prisma.TruvernRemediationRequestGetPayload<T>
> {
  return client.truvernRemediationRequest.create(args);
}
