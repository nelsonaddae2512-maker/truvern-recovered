import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type TruvernFrameworkClient = Pick<
  Prisma.TransactionClient,
  "truvernFramework"
>;

export async function findTruvernFramework<
  T extends Prisma.TruvernFrameworkFindUniqueArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernFrameworkFindUniqueArgs
  >,
  client: TruvernFrameworkClient = prisma,
): Promise<
  Prisma.TruvernFrameworkGetPayload<T> | null
> {
  return client.truvernFramework.findUnique(args);
}

export async function findTruvernFrameworks<
  T extends Prisma.TruvernFrameworkFindManyArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.TruvernFrameworkFindManyArgs>,
  client: TruvernFrameworkClient = prisma,
): Promise<Prisma.TruvernFrameworkGetPayload<T>[]> {
  return client.truvernFramework.findMany(args);
}

export async function createTruvernFramework<
  T extends Prisma.TruvernFrameworkCreateArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.TruvernFrameworkCreateArgs>,
  client: TruvernFrameworkClient = prisma,
): Promise<Prisma.TruvernFrameworkGetPayload<T>> {
  return client.truvernFramework.create(args);
}

export async function updateTruvernFramework<
  T extends Prisma.TruvernFrameworkUpdateArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.TruvernFrameworkUpdateArgs>,
  client: TruvernFrameworkClient = prisma,
): Promise<Prisma.TruvernFrameworkGetPayload<T>> {
  return client.truvernFramework.update(args);
}
