import { createHash } from "node:crypto";

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const REPAIR_USER_ID = 1;
const REPAIR_ORGANIZATION_ID = 7;
const REPAIR_ROLE = "OWNER";

function sha256(value: string) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function noStoreJson(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export async function GET() {
  await requireOpsAccess();

  const session = await auth();
  const clerkUserId = session.userId;

  if (!clerkUserId) {
    return noStoreJson(
      {
        authenticated: false,
        currentClerkIdFingerprint: null,
        matchingDbUserCount: null,
        matchingDbUserIds: [],
      },
      401,
    );
  }

  const matchingUsers = await prisma.user.findMany({
    where: {
      clerkId: clerkUserId,
    },
    select: {
      id: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return noStoreJson({
    authenticated: true,
    currentClerkIdFingerprint: sha256(clerkUserId),
    matchingDbUserCount: matchingUsers.length,
    matchingDbUserIds: matchingUsers.map((user) => user.id),
  });
}

export async function POST() {
  await requireOpsAccess();

  const session = await auth();
  const clerkUserId = session.userId;

  if (!clerkUserId) {
    return noStoreJson(
      {
        repaired: false,
        reason: "UNAUTHENTICATED",
      },
      401,
    );
  }

  const clerkUser =
    await currentUser().catch(() => null);

  if (!clerkUser || clerkUser.id !== clerkUserId) {
    return noStoreJson(
      {
        repaired: false,
        reason: "CLERK_USER_MISMATCH",
      },
      409,
    );
  }

  const primaryEmail =
    clerkUser.primaryEmailAddress
      ?.emailAddress
      ?.trim()
      .toLowerCase() ?? "";

  if (!primaryEmail) {
    return noStoreJson(
      {
        repaired: false,
        reason: "PRIMARY_EMAIL_MISSING",
      },
      409,
    );
  }

  const expectedOldFingerprint =
    process.env
      .TRUVERN_IDENTITY_REPAIR_OLD_CLERK_SHA256
      ?.trim()
      .toLowerCase() ?? "";

  if (
    !/^[a-f0-9]{64}$/.test(
      expectedOldFingerprint,
    )
  ) {
    return noStoreJson(
      {
        repaired: false,
        reason:
          "REPAIR_OLD_FINGERPRINT_NOT_CONFIGURED",
      },
      503,
    );
  }

  try {
    const result =
      await prisma.$transaction(
        async (tx) => {
          const targetUser =
            await tx.user.findUnique({
              where: {
                id: REPAIR_USER_ID,
              },
              select: {
                id: true,
                email: true,
                clerkId: true,
                organizationId: true,
              },
            });

          if (!targetUser) {
            throw new Error(
              "TARGET_USER_MISSING",
            );
          }

          if (
            targetUser.email
              .trim()
              .toLowerCase() !== primaryEmail
          ) {
            throw new Error(
              "TARGET_EMAIL_MISMATCH",
            );
          }

          if (
            targetUser.organizationId !==
            REPAIR_ORGANIZATION_ID
          ) {
            throw new Error(
              "TARGET_ORGANIZATION_MISMATCH",
            );
          }

          if (!targetUser.clerkId) {
            throw new Error(
              "TARGET_OLD_CLERK_ID_MISSING",
            );
          }

          const oldFingerprint =
            sha256(targetUser.clerkId);

          if (
            oldFingerprint !==
            expectedOldFingerprint
          ) {
            throw new Error(
              "TARGET_OLD_FINGERPRINT_MISMATCH",
            );
          }

          if (
            targetUser.clerkId ===
            clerkUserId
          ) {
            throw new Error(
              "TARGET_ALREADY_BOUND",
            );
          }

          const emailUsers =
            await tx.user.findMany({
              where: {
                email: {
                  equals: primaryEmail,
                  mode: "insensitive",
                },
              },
              select: {
                id: true,
              },
              orderBy: {
                id: "asc",
              },
            });

          if (
            emailUsers.length !== 1 ||
            emailUsers[0]?.id !==
              REPAIR_USER_ID
          ) {
            throw new Error(
              "EMAIL_NOT_UNIQUE_TO_TARGET",
            );
          }

          const currentIdentityCollision =
            await tx.user.findUnique({
              where: {
                clerkId: clerkUserId,
              },
              select: {
                id: true,
              },
            });

          if (currentIdentityCollision) {
            throw new Error(
              "CURRENT_CLERK_ID_COLLISION",
            );
          }

          const memberships =
            await tx.orgMembership.findMany({
              where: {
                userId: REPAIR_USER_ID,
                organizationId:
                  REPAIR_ORGANIZATION_ID,
              },
              select: {
                id: true,
                role: true,
              },
              orderBy: {
                id: "asc",
              },
            });

          if (
            memberships.length !== 1 ||
            memberships[0]?.role !==
              REPAIR_ROLE
          ) {
            throw new Error(
              "OWNER_MEMBERSHIP_MISMATCH",
            );
          }

          const updated =
            await tx.user.updateMany({
              where: {
                id: REPAIR_USER_ID,
                clerkId:
                  targetUser.clerkId,
                organizationId:
                  REPAIR_ORGANIZATION_ID,
              },
              data: {
                clerkId: clerkUserId,
              },
            });

          if (updated.count !== 1) {
            throw new Error(
              "CONDITIONAL_UPDATE_FAILED",
            );
          }

          const verifiedUser =
            await tx.user.findUnique({
              where: {
                id: REPAIR_USER_ID,
              },
              select: {
                id: true,
                clerkId: true,
                organizationId: true,
              },
            });

          if (
            !verifiedUser ||
            verifiedUser.clerkId !==
              clerkUserId ||
            verifiedUser.organizationId !==
              REPAIR_ORGANIZATION_ID
          ) {
            throw new Error(
              "POST_UPDATE_VERIFICATION_FAILED",
            );
          }

          return {
            userId: verifiedUser.id,
            organizationId:
              verifiedUser.organizationId,
            newClerkIdFingerprint:
              sha256(clerkUserId),
          };
        },
      );

    return noStoreJson({
      repaired: true,
      userId: result.userId,
      organizationId:
        result.organizationId,
      role: REPAIR_ROLE,
      newClerkIdFingerprint:
        result.newClerkIdFingerprint,
    });
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "UNKNOWN_REPAIR_FAILURE";

    return noStoreJson(
      {
        repaired: false,
        reason,
      },
      409,
    );
  }
}