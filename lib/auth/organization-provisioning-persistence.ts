import type {
  OrgRole,
  Prisma,
} from "@prisma/client";

import prisma from "@/lib/prisma";

export type OrganizationProvisioningPersistenceInput = {
  clerkUserId: string;
  clerkOrganizationId: string;
  authorizedRole: OrgRole;
};

export type OrganizationProvisioningPersistenceResult =
  | {
      ok: true;
      userId: number;
      organizationId: number;
      role: OrgRole;
      membershipCreated: boolean;
      primaryOrganizationUpdated: boolean;
    }
  | {
      ok: false;
      reason:
        | "INVALID_INPUT"
        | "USER_NOT_PROVISIONED"
        | "ORGANIZATION_NOT_PROVISIONED";
    };

type ProvisioningTransaction =
  Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0];

const PROVISIONABLE_ROLES: readonly OrgRole[] = [
  "OWNER",
  "ADMIN",
  "ANALYST",
  "VIEWER",
];

function isProvisionableRole(
  role: OrgRole,
): role is OrgRole {
  return PROVISIONABLE_ROLES.includes(role);
}

export async function persistVerifiedOrganizationProvisioning(
  input: OrganizationProvisioningPersistenceInput,
  dependencies: {
    runTransaction?: <T>(
      callback: (
        tx: ProvisioningTransaction,
      ) => Promise<T>,
    ) => Promise<T>;
  } = {},
): Promise<OrganizationProvisioningPersistenceResult> {
  const clerkUserId = input.clerkUserId.trim();
  const clerkOrganizationId =
    input.clerkOrganizationId.trim();

  if (
    !clerkUserId ||
    !clerkOrganizationId ||
    !isProvisionableRole(input.authorizedRole)
  ) {
    return {
      ok: false,
      reason: "INVALID_INPUT",
    };
  }

  const runTransaction =
    dependencies.runTransaction ??
    (<T>(
      callback: (
        tx: ProvisioningTransaction,
      ) => Promise<T>,
    ) => prisma.$transaction(callback));

  return runTransaction(async (tx) => {
    /*
     * Identity claiming is intentionally outside this service.
     *
     * Persistence is allowed only for a DB user already bound to
     * the exact authenticated Clerk identity.
     */
    const user = await tx.user.findUnique({
      where: {
        clerkId: clerkUserId,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!user) {
      return {
        ok: false as const,
        reason: "USER_NOT_PROVISIONED" as const,
      };
    }

    /*
     * Organization creation/rebinding is also intentionally
     * outside this service. The Clerk organization must already
     * have an exact Truvern Organization binding.
     */
    const organization =
      await tx.organization.findUnique({
        where: {
          clerkOrgId: clerkOrganizationId,
        },
        select: {
          id: true,
        },
      });

    if (!organization) {
      return {
        ok: false as const,
        reason:
          "ORGANIZATION_NOT_PROVISIONED" as const,
      };
    }

    const existingMembership =
      await tx.orgMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: organization.id,
          },
        },
        select: {
          role: true,
        },
      });

    let role: OrgRole;
    let membershipCreated = false;

    if (existingMembership) {
      /*
       * Never elevate or downgrade an existing Truvern role as a
       * side effect of provisioning.
       */
      role = existingMembership.role;
    } else {
      const created =
        await tx.orgMembership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: input.authorizedRole,
          },
          select: {
            role: true,
          },
        });

      role = created.role;
      membershipCreated = true;
    }

    let primaryOrganizationUpdated = false;

    if (user.organizationId !== organization.id) {
      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          organizationId: organization.id,
        },
        select: {
          id: true,
        },
      });

      primaryOrganizationUpdated = true;
    }

    return {
      ok: true as const,
      userId: user.id,
      organizationId: organization.id,
      role,
      membershipCreated,
      primaryOrganizationUpdated,
    };
  });
}