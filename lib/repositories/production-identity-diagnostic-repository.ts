import prisma from "@/lib/prisma";

export async function readProductionIdentityState(
  authenticatedUserId: string,
  authenticatedOrganizationId: string,
  expectedUserId: number,
  expectedOrganizationId: number,
) {
  return prisma.$transaction([
    prisma.user.findUnique({
      where: {
        id: expectedUserId,
      },
      select: {
        id: true,
        clerkId: true,
        organizationId: true,
        memberships: {
          select: {
            organizationId: true,
            role: true,
          },
          orderBy: {
            organizationId: "asc",
          },
        },
      },
    }),

    prisma.organization.findUnique({
      where: {
        id: expectedOrganizationId,
      },
      select: {
        id: true,
        clerkOrgId: true,
      },
    }),

    prisma.user.count({
      where: {
        clerkId: authenticatedUserId,
      },
    }),

    prisma.organization.count({
      where: {
        clerkOrgId: authenticatedOrganizationId,
      },
    }),

    prisma.orgMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: expectedUserId,
          organizationId: expectedOrganizationId,
        },
      },
      select: {
        id: true,
        role: true,
      },
    }),
  ]);
}

export async function countOrganizationClerkBinding(
  clerkOrgId: string | null,
) {
  return prisma.organization.count({
    where: {
      clerkOrgId,
    },
  });
}
