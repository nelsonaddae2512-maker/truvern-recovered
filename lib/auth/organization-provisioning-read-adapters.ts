import { clerkClient } from "@clerk/nextjs/server";

import prisma from "@/lib/prisma";

import type {
  TruvernCustomerRole,
} from "@/lib/auth/organization-provisioning-policy";

export type VerifiedClerkOrganizationMembership = {
  userId: string;
  organizationId: string;
  role: string;
};

export type ProvisioningReadAdapterDependencies = {
  getClerkMembershipList: (input: {
    organizationId: string;
    userId: string;
  }) => Promise<
    Array<{
      userId: string | null;
      organizationId: string;
      role: string;
    }>
  >;

  getClerkOrganization: (input: {
    organizationId: string;
  }) => Promise<
    | {
        id: string;
        name: string;
        createdBy: string | null;
      }
    | null
  >;

  findDatabaseUser: (input: {
    clerkUserId: string;
  }) => Promise<
    | {
        id: number;
      }
    | null
  >;

  findDatabaseOrganization: (input: {
    clerkOrganizationId: string;
  }) => Promise<
    | {
        id: number;
      }
    | null
  >;

  findDatabaseMembership: (input: {
    userId: number;
    organizationId: number;
  }) => Promise<
    | {
        role: string;
      }
    | null
  >;
};

const TRUVERN_CUSTOMER_ROLES = new Set<TruvernCustomerRole>([
  "OWNER",
  "ADMIN",
  "ANALYST",
  "VIEWER",
]);

function asTruvernCustomerRole(
  value: string,
): TruvernCustomerRole | null {
  const normalized = value.toUpperCase();

  if (
    !TRUVERN_CUSTOMER_ROLES.has(
      normalized as TruvernCustomerRole,
    )
  ) {
    return null;
  }

  return normalized as TruvernCustomerRole;
}

export async function readVerifiedClerkOrganizationMembership(
  input: {
    authenticatedUserId: string;
    organizationId: string;
  },
  dependencies: Pick<
    ProvisioningReadAdapterDependencies,
    "getClerkMembershipList"
  >,
): Promise<VerifiedClerkOrganizationMembership | null> {
  const memberships =
    await dependencies.getClerkMembershipList({
      organizationId: input.organizationId,
      userId: input.authenticatedUserId,
    });

  const exact =
    memberships.filter(
      (membership) =>
        membership.userId === input.authenticatedUserId &&
        membership.organizationId === input.organizationId,
    );

  if (exact.length !== 1) {
    return null;
  }

  return {
    userId: exact[0].userId!,
    organizationId: exact[0].organizationId,
    role: exact[0].role,
  };
}

export async function readClerkOrganizationCreatedByUserId(
  input: {
    organizationId: string;
  },
  dependencies: Pick<
    ProvisioningReadAdapterDependencies,
    "getClerkOrganization"
  >,
): Promise<string | null> {
  const organization =
    await dependencies.getClerkOrganization({
      organizationId: input.organizationId,
    });

  if (
    !organization ||
    organization.id !== input.organizationId
  ) {
    return null;
  }

  return organization.createdBy;
}

export async function readExistingTruvernOrganizationRole(
  input: {
    authenticatedUserId: string;
    organizationId: string;
  },
  dependencies: Pick<
    ProvisioningReadAdapterDependencies,
    | "findDatabaseUser"
    | "findDatabaseOrganization"
    | "findDatabaseMembership"
  >,
): Promise<TruvernCustomerRole | null> {
  const dbUser =
    await dependencies.findDatabaseUser({
      clerkUserId: input.authenticatedUserId,
    });

  if (!dbUser) {
    return null;
  }

  const dbOrganization =
    await dependencies.findDatabaseOrganization({
      clerkOrganizationId: input.organizationId,
    });

  if (!dbOrganization) {
    return null;
  }

  const membership =
    await dependencies.findDatabaseMembership({
      userId: dbUser.id,
      organizationId: dbOrganization.id,
    });

  if (!membership) {
    return null;
  }

  return asTruvernCustomerRole(membership.role);
}

export const provisioningReadAdapterDependencies:
  ProvisioningReadAdapterDependencies = {
    async getClerkMembershipList(input) {
      const client =
        await clerkClient();

      const result =
        await client.organizations.getOrganizationMembershipList({
          organizationId: input.organizationId,
          userId: [input.userId],
          limit: 10,
        });

      return result.data.map((membership) => ({
        userId:
          membership.publicUserData?.userId ??
          null,
        organizationId:
          membership.organization.id,
        role:
          String(membership.role),
      }));
    },

    async getClerkOrganization(input) {
      const client =
        await clerkClient();

      try {
        const organization =
          await client.organizations.getOrganization({
            organizationId: input.organizationId,
          });

        return {
          id: organization.id,
          name: organization.name,
          createdBy:
            organization.createdBy ??
            null,
        };
      } catch {
        return null;
      }
    },

    async findDatabaseUser(input) {
      return prisma.user.findUnique({
        where: {
          clerkId: input.clerkUserId,
        },
        select: {
          id: true,
        },
      });
    },

    async findDatabaseOrganization(input) {
      return prisma.organization.findUnique({
        where: {
          clerkOrgId: input.clerkOrganizationId,
        },
        select: {
          id: true,
        },
      });
    },

    async findDatabaseMembership(input) {
      return prisma.orgMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: input.organizationId,
          },
        },
        select: {
          role: true,
        },
      });
    },
  };