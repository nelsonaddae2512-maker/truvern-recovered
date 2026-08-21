import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type OrganizationClient = Pick<
  Prisma.TransactionClient,
  "organization"
>;

export async function findOrganizations<
  T extends Prisma.OrganizationFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.OrganizationFindManyArgs
  >,
  client: OrganizationClient = prisma,
): Promise<
  Prisma.OrganizationGetPayload<T>[]
> {
  return client.organization.findMany(args);
}

export async function findOrganization<
  T extends Prisma.OrganizationFindUniqueArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.OrganizationFindUniqueArgs>,
  client: OrganizationClient = prisma,
): Promise<Prisma.OrganizationGetPayload<T> | null> {
  return client.organization.findUnique(args);
}
