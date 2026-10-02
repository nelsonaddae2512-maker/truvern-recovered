import crypto from "node:crypto";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EXPECTED = {
  userId: 1,
  organizationId: 8,
} as const;

function fingerprint(
  value: string | null | undefined
) {
  if (!value) return null;

  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 16);
}

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
    },
  });
}

export async function GET() {
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
    return json(
      {
        ok: false,
        code: "AUTH_CONTEXT_REQUIRED",
        rawIdsReturned: false,
      },
      401
    );
  }

  if (orgRole !== "org:admin") {
    return json(
      {
        ok: false,
        code: "ORG_ADMIN_REQUIRED",
        rawIdsReturned: false,
      },
      403
    );
  }

  const [
    user,
    organization,
    liveUserBindingCount,
    liveOrganizationBindingCount,
    organization8Membership,
  ] = await prisma.$transaction([
    prisma.user.findUnique({
      where: {
        id: EXPECTED.userId,
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
        id: EXPECTED.organizationId,
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
          userId: EXPECTED.userId,
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

  if (!user || !organization) {
    return json(
      {
        ok: false,
        code: "TARGET_MISSING",
        rawIdsReturned: false,
      },
      404
    );
  }

  const oldOrganization8BindingCount =
    await prisma.organization.count({
      where: {
        clerkOrgId: organization.clerkOrgId,
      },
    });

  return json({
    ok: true,

    runtimeAuth: {
      signedIn: true,
      userFingerprint:
        fingerprint(authenticatedUserId),
      organizationPresent: true,
      organizationFingerprint:
        fingerprint(authenticatedOrganizationId),
      organizationRole: orgRole,
    },

    database: {
      user1: {
        id: user.id,
        clerkBindingPresent:
          user.clerkId !== null,
        clerkFingerprint:
          fingerprint(user.clerkId),
        organizationId:
          user.organizationId,
        memberships:
          user.memberships.map(
            (membership) => ({
              organizationId:
                membership.organizationId,
              role: membership.role,
            })
          ),
      },

      organization8: {
        id: organization.id,
        clerkBindingPresent:
          organization.clerkOrgId !== null,
        clerkFingerprint:
          fingerprint(
            organization.clerkOrgId
          ),
      },

      collisions: {
        liveUserBindingCount,
        liveOrganizationBindingCount,
        oldOrganization8BindingCount,
      },

      organization8Membership: {
        present:
          organization8Membership !== null,
        role:
          organization8Membership?.role ??
          null,
      },
    },

    safety: {
      method: "GET",
      databaseReadsOnly: true,
      databaseWrites: false,
      clerkBackendApiRequest: false,
      clerkMutation: false,
      bootstrapInvocation: false,
      provisioningInvocation: false,
    },

    rawIdsReturned: false,
  });
}
