import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type OrgMembershipClient = Pick<
  Prisma.TransactionClient,
  "orgMembership"
>;

export async function findFirstOrgMembership<
  T extends Prisma.OrgMembershipFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.OrgMembershipFindFirstArgs
  >,
  client: OrgMembershipClient = prisma,
): Promise<
  Prisma.OrgMembershipGetPayload<T> | null
> {
  return client.orgMembership.findFirst(args);
}

export async function upsertOrgMembership<
  T extends Prisma.OrgMembershipUpsertArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.OrgMembershipUpsertArgs
  >,
  client: OrgMembershipClient = prisma,
): Promise<
  Prisma.OrgMembershipGetPayload<T>
> {
  return client.orgMembership.upsert(args);
}
