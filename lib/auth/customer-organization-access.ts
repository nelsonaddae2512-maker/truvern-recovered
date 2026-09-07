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

  const membership =
    await prisma.orgMembership.findFirst({
      where: {
        userId: dbUserId,
        role: {
          in: [...CUSTOMER_ROLES],
        },
      },
      select: {
        organizationId: true,
        role: true,
      },
      orderBy: [
        {
          id: "asc",
        },
      ],
    });

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
