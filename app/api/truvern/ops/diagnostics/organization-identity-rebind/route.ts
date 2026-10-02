import {
  createHash,
} from "crypto";

import { auth } from "@clerk/nextjs/server";

import {
  requireOpsAccess,
} from "@/lib/auth/truvern-governance";

import {
  prisma,
} from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CONFIRMATION =
  "D.60BR.40Z14C-EXECUTE-ORG8-ONLY-REBIND";

const EXPECTED = {
  userId: 1,
  organizationId: 8,
  userOrganizationId: 8,
  userFingerprint:
    "fa6d1bbaaf2b8a2b",
  liveOrganizationFingerprint:
    "cb5d109a946b0c90",
  oldOrganizationFingerprint:
    "f3c1bf7a4da31c24",
} as const;

function fingerprint(
  value: string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 16);
}

function noStoreJson(
  body: unknown,
  status = 200,
): Response {
  return Response.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}

export async function POST(
  request: Request,
) {
  await requireOpsAccess();

  const {
    userId: authenticatedUserId,
    orgId: authenticatedOrganizationId,
    orgRole,
  } = await auth();

  if (
    !authenticatedUserId ||
    !authenticatedOrganizationId
  ) {
    return noStoreJson(
      {
        ok: false,
        code: "AUTH_CONTEXT_REQUIRED",
        rawIdsReturned: false,
      },
      401,
    );
  }

  if (orgRole !== "org:admin") {
    return noStoreJson(
      {
        ok: false,
        code: "ORG_ADMIN_REQUIRED",
        rawIdsReturned: false,
      },
      403,
    );
  }

  const liveUserFingerprint =
    fingerprint(authenticatedUserId);

  const liveOrganizationFingerprint =
    fingerprint(
      authenticatedOrganizationId,
    );

  if (
    liveUserFingerprint !==
      EXPECTED.userFingerprint ||
    liveOrganizationFingerprint !==
      EXPECTED.liveOrganizationFingerprint
  ) {
    return noStoreJson(
      {
        ok: false,
        code: "LIVE_IDENTITY_MISMATCH",
        rawIdsReturned: false,
      },
      409,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  }
  catch {
    return noStoreJson(
      {
        ok: false,
        code: "INVALID_JSON",
        rawIdsReturned: false,
      },
      400,
    );
  }

  const confirmation =
    typeof body === "object" &&
    body !== null &&
    "confirmation" in body
      ? (
          body as {
            confirmation?: unknown;
          }
        ).confirmation
      : undefined;

  if (
    confirmation !== CONFIRMATION
  ) {
    return noStoreJson(
      {
        ok: false,
        code: "CONFIRMATION_REQUIRED",
        rawIdsReturned: false,
      },
      400,
    );
  }



  try {
    const result =
      await prisma.$transaction(
        async (tx) => {
          const user =
            await tx.user.findUnique({
              where: {
                id: EXPECTED.userId,
              },
              select: {
                id: true,
                clerkId: true,
                organizationId: true,
              },
            });

          if (!user) {
            throw new Error(
              "GUARD_USER_MISSING",
            );
          }

          /*
           * The production user is already
           * correctly Clerk-bound.
           *
           * Preserve it. Do not write User.
           */
          if (
            user.clerkId !==
            authenticatedUserId
          ) {
            throw new Error(
              "GUARD_USER_BINDING_MISMATCH",
            );
          }

          if (
            user.organizationId !==
            EXPECTED.userOrganizationId
          ) {
            throw new Error(
              "GUARD_USER_PRIMARY_ORG_CHANGED",
            );
          }

          const organization =
            await tx.organization.findUnique({
              where: {
                id:
                  EXPECTED.organizationId,
              },
              select: {
                id: true,
                clerkOrgId: true,
              },
            });

          if (!organization) {
            throw new Error(
              "GUARD_ORG8_MISSING",
            );
          }

          if (
            !organization.clerkOrgId ||
            fingerprint(
              organization.clerkOrgId,
            ) !==
              EXPECTED.oldOrganizationFingerprint
          ) {
            throw new Error(
              "GUARD_ORG8_OLD_BINDING_CHANGED",
            );
          }

          const [
            targetOrgCollision,
            oldOrgBindings,
            org8Membership,
          ] =
            await Promise.all([
              tx.organization.findUnique({
                where: {
                  clerkOrgId:
                    authenticatedOrganizationId,
                },
                select: {
                  id: true,
                },
              }),

              tx.organization.count({
                where: {
                  clerkOrgId:
                    organization.clerkOrgId,
                },
              }),

              tx.orgMembership.findUnique({
                where: {
                  userId_organizationId: {
                    userId:
                      EXPECTED.userId,
                    organizationId:
                      EXPECTED.organizationId,
                  },
                },
                select: {
                  id: true,
                  role: true,
                },
              }),
            ]);

          if (targetOrgCollision) {
            throw new Error(
              "GUARD_LIVE_ORG_ALREADY_BOUND",
            );
          }

          if (oldOrgBindings !== 1) {
            throw new Error(
              "GUARD_OLD_ORG_BINDING_NOT_UNIQUE",
            );
          }

          /*
           * Production diagnostics already
           * established this membership.
           * Preserve it and require ADMIN.
           */
          if (!org8Membership) {
            throw new Error(
              "GUARD_ORG8_MEMBERSHIP_MISSING",
            );
          }

          if (
            org8Membership.role !== "ADMIN"
          ) {
            throw new Error(
              "GUARD_ORG8_MEMBERSHIP_ROLE_CHANGED",
            );
          }

          /*
           * Sole authorized database write.
           */
          const updatedOrganization =
            await tx.organization.updateMany({
              where: {
                id:
                  EXPECTED.organizationId,
                clerkOrgId:
                  organization.clerkOrgId,
              },
              data: {
                clerkOrgId:
                  authenticatedOrganizationId,
              },
            });

          if (
            updatedOrganization.count !== 1
          ) {
            throw new Error(
              "WRITE_ORG_BINDING_COUNT_MISMATCH",
            );
          }

          return {
            organizationUpdated:
              updatedOrganization.count,
            userUpdated: false,
            membershipUpdated: false,
            primaryOrganizationUpdated:
              false,
          };
        },
      );

    return noStoreJson({
      ok: true,
      code:
        "ORG8_IDENTITY_REBIND_COMPLETE",
      result,
      rawIdsReturned: false,
    });
  }
  catch (error) {
    const code =
      error instanceof Error
        ? error.message
        : "UNKNOWN_REPAIR_FAILURE";

    return noStoreJson(
      {
        ok: false,
        code,
        rawIdsReturned: false,
      },
      409,
    );
  }
}

