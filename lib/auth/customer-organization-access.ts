import { auth, currentUser } from "@clerk/nextjs/server";

import prisma from "@/lib/prisma";
import {
  claimGovernanceDbUserByEmail,
  readGovernanceDbUserId,
} from "@/lib/repositories/governance-auth-repository";

export type CustomerOrganizationActor = {
  userId: string;
  dbUserId: number;
  organizationId: number;
  role:
    | "OWNER"
    | "ADMIN"
    | "ANALYST"
    | "VIEWER";
};

const CUSTOMER_ROLES = [
  "OWNER",
  "ADMIN",
  "ANALYST",
  "VIEWER",
] as const;

async function resolveDbUserId(
  clerkUserId: string,
) {
  const existing =
    await readGovernanceDbUserId(
      clerkUserId,
    );

  if (existing[0]?.id) {
    return existing[0].id;
  }

  const clerkUser =
    await currentUser().catch(
      () => null,
    );

  if (
    !clerkUser ||
    clerkUser.id !== clerkUserId
  ) {
    return null;
  }

  const email =
    clerkUser.primaryEmailAddress
      ?.emailAddress
      ?.trim()
      .toLowerCase() ??
    "";

  if (!email) {
    return null;
  }

  const claimed =
    await claimGovernanceDbUserByEmail({
      clerkUserId,
      email,
    });

  return claimed?.id ?? null;
}

export async function getCustomerOrganizationActor(): Promise<
  CustomerOrganizationActor | null
> {
  const session = await auth();

  if (!session.userId) {
    return null;
  }

  const dbUserId =
    await resolveDbUserId(
      session.userId,
    );

  if (!dbUserId) {
    return null;
  }

  const membershipSelect = {
    organizationId: true,
    role: true,
  } as const;

  const membershipWhere = {
    userId: dbUserId,
    role: {
      in: [...CUSTOMER_ROLES],
    },
  };

  let membership = null;

  if (session.orgId) {
    const selectedOrganization =
      await prisma.organization.findFirst({
        where: {
          clerkOrgId: session.orgId,
        },
        select: {
          id: true,
        },
      });

    if (selectedOrganization) {
      membership =
        await prisma.orgMembership.findFirst({
          where: {
            ...membershipWhere,
            organizationId:
              selectedOrganization.id,
          },
          select: membershipSelect,
        });
    }
  }

  if (!membership) {
    const dbUser =
      await prisma.user.findUnique({
        where: {
          id: dbUserId,
        },
        select: {
          organizationId: true,
        },
      });

    if (dbUser?.organizationId) {
      membership =
        await prisma.orgMembership.findFirst({
          where: {
            ...membershipWhere,
            organizationId:
              dbUser.organizationId,
          },
          select: membershipSelect,
        });
    }
  }

  if (!membership) {
    membership =
      await prisma.orgMembership.findFirst({
        where: membershipWhere,
        select: membershipSelect,
        orderBy: [
          {
            id: "asc",
          },
        ],
      });
  }

  if (!membership) {
    return null;
  }

  const role =
    String(
      membership.role,
    ).toUpperCase();

  if (
    role !== "OWNER" &&
    role !== "ADMIN" &&
    role !== "ANALYST" &&
    role !== "VIEWER"
  ) {
    return null;
  }

  return {
    userId: session.userId,
    dbUserId,
    organizationId:
      membership.organizationId,
    role,
  };
}

export function canManageCustomerMembers(
  actor: CustomerOrganizationActor,
) {
  return (
    actor.role === "OWNER" ||
    actor.role === "ADMIN"
  );
}
