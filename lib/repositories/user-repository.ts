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
