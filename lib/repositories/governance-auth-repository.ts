import prisma from "@/lib/prisma";

export type GovernanceAuthUserRow = {
  id: number;
};

export async function readGovernanceDbUserId(
  clerkUserId: string,
): Promise<GovernanceAuthUserRow[]> {
  const user = await prisma.user.findUnique({
    where: {
      clerkId: clerkUserId,
    },
    select: {
      id: true,
    },
  });

  if (user) {
    return [user];
  }

  const numericUserId = Number(clerkUserId);

  if (
    Number.isSafeInteger(numericUserId) &&
    numericUserId > 0 &&
    String(numericUserId) === clerkUserId
  ) {
    const numericUser = await prisma.user.findUnique({
      where: {
        id: numericUserId,
      },
      select: {
        id: true,
      },
    });

    if (numericUser) {
      return [numericUser];
    }
  }

  return [];
}
export type GovernanceClaimedUserRow = {
  id: number;
};

export async function claimGovernanceDbUserByEmail(input: {
  clerkUserId: string;
  email: string;
}): Promise<GovernanceClaimedUserRow | null> {
  const email =
    input.email.trim().toLowerCase();

  if (!email) {
    return null;
  }

  /*
   * This is deliberately a claim of an already-provisioned,
   * unbound Truvern user only.
   *
   * Never move a DB user from one Clerk identity to another.
   */
  const candidate =
    await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        clerkId: true,
      },
    });

  if (!candidate) {
    return null;
  }

  if (candidate.clerkId) {
    return candidate.clerkId === input.clerkUserId
      ? { id: candidate.id }
      : null;
  }

  /*
   * Atomic claim: clerkId must still be null at update time.
   * This prevents two identities from racing to claim the
   * same pre-provisioned Truvern user.
   */
  const claimed =
    await prisma.user.updateMany({
      where: {
        id: candidate.id,
        clerkId: null,
      },
      data: {
        clerkId: input.clerkUserId,
      },
    });

  if (claimed.count !== 1) {
    return null;
  }

  return {
    id: candidate.id,
  };
}
function isPrismaUniqueConstraintError(
  error: unknown,
): error is {
  code: "P2002";
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code ===
      "P2002"
  );
}
export type GovernanceCreatedUserRow = {
  id: number;
};

export type GovernanceCreateUserResult =
  | {
      ok: true;
      user: GovernanceCreatedUserRow;
      created: true;
    }
  | {
      ok: false;
      reason: "IDENTITY_ALREADY_EXISTS";
    };

/*
 * Create the first Truvern DB identity only after the caller has
 * completed the certified Clerk identity / organization-membership
 * verification boundary.
 *
 * This function grants no organization role and creates no
 * Organization or OrgMembership.
 *
 * Unique email / clerkId constraints remain the concurrency authority.
 * A conflicting create fails closed and is re-resolved by the caller;
 * this function never rebinds an existing identity.
 */
export async function createGovernanceDbUser(input: {
  clerkUserId: string;
  email: string;
}): Promise<GovernanceCreateUserResult> {
  const clerkUserId =
    input.clerkUserId.trim();

  const email =
    input.email.trim().toLowerCase();

  if (!clerkUserId || !email) {
    return {
      ok: false,
      reason: "IDENTITY_ALREADY_EXISTS",
    };
  }

  try {
    const user =
      await prisma.user.create({
        data: {
          clerkId: clerkUserId,
          email,
        },
        select: {
          id: true,
        },
      });

    return {
      ok: true,
      user,
      created: true,
    };
  } catch (error) {
    if (
      isPrismaUniqueConstraintError(error)
    ) {
      /*
       * A concurrent create or existing unique identity is
       * re-resolved by the bootstrap adapter. Never rebind here.
       */
      return {
        ok: false,
        reason: "IDENTITY_ALREADY_EXISTS",
      };
    }

    /*
     * Infrastructure, validation, connection, and all other
     * unexpected Prisma failures retain their real failure semantics.
     */
    throw error;
  }
}