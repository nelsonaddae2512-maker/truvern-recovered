import prisma from "@/lib/prisma";

export type ReviewAssignmentAnalystRow = {
  userId: string;
  name: string;
  email: string | null;
};

export async function readOrganizationReviewAnalysts(
  organizationId: string | number,
): Promise<ReviewAssignmentAnalystRow[]> {
  return prisma.$queryRaw<ReviewAssignmentAnalystRow[]>`
    select
      u.id::text as "userId",
      coalesce(u.name, u.email)::text as name,
      u.email::text as email
    from "OrgMembership" m
    join "User" u
      on u.id::text = m."userId"::text
    where m."organizationId"::text = ${String(organizationId)}::text
    order by coalesce(u.name, u.email) asc
  `;
}