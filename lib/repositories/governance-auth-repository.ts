import prisma from "@/lib/prisma";

export type GovernanceAuthUserRow = {
  id: number;
};

export async function readGovernanceDbUserId(
  clerkUserId: string,
): Promise<GovernanceAuthUserRow[]> {
  return prisma.$queryRaw<GovernanceAuthUserRow[]>`
    select id
    from "User"
    where "clerkUserId" = ${clerkUserId}
       or id::text = ${clerkUserId}
    limit 1
  `;
}