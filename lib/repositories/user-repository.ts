import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type UserClient = Pick<
  Prisma.TransactionClient,
  "user"
>;

export async function upsertUser<
  T extends Prisma.UserUpsertArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.UserUpsertArgs
  >,
  client: UserClient = prisma,
): Promise<
  Prisma.UserGetPayload<T>
> {
  return client.user.upsert(args);
}
export async function findUser<
  T extends Prisma.UserFindUniqueArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.UserFindUniqueArgs>,
  client: UserClient = prisma,
): Promise<Prisma.UserGetPayload<T> | null> {
  return client.user.findUnique(args);
}

export async function findUsers<
  T extends Prisma.UserFindManyArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.UserFindManyArgs>,
  client: UserClient = prisma,
): Promise<Prisma.UserGetPayload<T>[]> {
  return client.user.findMany(args);
}
