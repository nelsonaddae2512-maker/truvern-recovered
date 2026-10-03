import crypto from "node:crypto";

import {
  auth,
  currentUser,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CUSTOMER_ROLES = [
  "OWNER",
  "ADMIN",
  "ANALYST",
  "VIEWER",
] as const;

function fingerprint(
  value: string | null | undefined,
) {
  if (!value) return null;

  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 16);
}

function normalizeEmail(
  value: string | null | undefined,
) {
  return value?.trim().toLowerCase() ?? null;
}

export async function GET() {
  const {
    userId: clerkUserId,
    orgId: selectedClerkOrgId,
    orgRole,
  } = await auth();

  if (!clerkUserId) {
    return NextResponse.json(
      {
        ok: false,
        code: "AUTHENTICATION_REQUIRED",
        rawIdentifiersReturned: false,
      },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  /*
   * IMPORTANT:
   *
   * This diagnostic intentionally does NOT call
   * getCustomerOrganizationActor().
   *
   * It also does NOT call claimGovernanceDbUserByEmail(),
   * provisioning code, Clerk backend APIs, or any mutation.
   */

  const clerkUser = await currentUser();

  const email =
    normalizeEmail(
      clerkUser?.primaryEmailAddress?.emailAddress,
    );

  const directUser =
    await prisma.user.findUnique({
      where: {
        clerkId: clerkUserId,
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
    });

  const emailUsers =
    email
      ? await prisma.user.findMany({
          where: {
            email: {
              equals: email,
              mode: "insensitive",
            },
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
          orderBy: {
            id: "asc",
          },
          take: 5,
        })
      : [];

  const selectedOrganization =
    selectedClerkOrgId
      ? await prisma.organization.findFirst({
          where: {
            clerkOrgId: selectedClerkOrgId,
          },
          select: {
            id: true,
            clerkOrgId: true,
          },
        })
      : null;

  const resolvedUser =
    directUser ??
    (
      emailUsers.length === 1 &&
      (
        emailUsers[0].clerkId === null ||
        emailUsers[0].clerkId === clerkUserId
      )
        ? emailUsers[0]
        : null
    );

  const eligibleMemberships =
    resolvedUser
      ? resolvedUser.memberships.filter(
          (membership) =>
            CUSTOMER_ROLES.includes(
              membership.role as
                (typeof CUSTOMER_ROLES)[number],
            ),
        )
      : [];

  const selectedOrganizationMembership =
    resolvedUser &&
    selectedOrganization
      ? resolvedUser.memberships.find(
          (membership) =>
            membership.organizationId ===
            selectedOrganization.id,
        ) ?? null
      : null;

  const primaryOrganizationMembership =
    resolvedUser?.organizationId
      ? resolvedUser.memberships.find(
          (membership) =>
            membership.organizationId ===
            resolvedUser.organizationId,
        ) ?? null
      : null;

  let wouldResolveOrganizationId:
    | number
    | null = null;

  let resolutionStage:
    | "SELECTED_ORGANIZATION"
    | "PRIMARY_ORGANIZATION"
    | "MEMBERSHIP_FALLBACK"
    | null = null;

  if (
    selectedOrganization &&
    selectedOrganizationMembership &&
    CUSTOMER_ROLES.includes(
      selectedOrganizationMembership.role as
        (typeof CUSTOMER_ROLES)[number],
    )
  ) {
    wouldResolveOrganizationId =
      selectedOrganization.id;

    resolutionStage =
      "SELECTED_ORGANIZATION";
  } else if (
    resolvedUser?.organizationId &&
    primaryOrganizationMembership &&
    CUSTOMER_ROLES.includes(
      primaryOrganizationMembership.role as
        (typeof CUSTOMER_ROLES)[number],
    )
  ) {
    wouldResolveOrganizationId =
      resolvedUser.organizationId;

    resolutionStage =
      "PRIMARY_ORGANIZATION";
  } else if (
    eligibleMemberships.length > 0
  ) {
    wouldResolveOrganizationId =
      eligibleMemberships[0].organizationId;

    resolutionStage =
      "MEMBERSHIP_FALLBACK";
  }

  let outcome:
    | "ACTOR_RESOLVABLE"
    | "DB_USER_NOT_RESOLVED"
    | "EMAIL_USER_UNBOUND"
    | "EMAIL_USER_BOUND_TO_DIFFERENT_CLERK_USER"
    | "AMBIGUOUS_EMAIL_MATCH"
    | "NO_ELIGIBLE_ORGANIZATION_ACCESS";

  if (
    directUser &&
    wouldResolveOrganizationId !== null
  ) {
    outcome = "ACTOR_RESOLVABLE";
  } else if (
    !directUser &&
    emailUsers.length === 0
  ) {
    outcome = "DB_USER_NOT_RESOLVED";
  } else if (
    !directUser &&
    emailUsers.length > 1
  ) {
    outcome = "AMBIGUOUS_EMAIL_MATCH";
  } else if (
    !directUser &&
    emailUsers.length === 1 &&
    emailUsers[0].clerkId === null
  ) {
    outcome = "EMAIL_USER_UNBOUND";
  } else if (
    !directUser &&
    emailUsers.length === 1 &&
    emailUsers[0].clerkId !== clerkUserId
  ) {
    outcome =
      "EMAIL_USER_BOUND_TO_DIFFERENT_CLERK_USER";
  } else if (
    wouldResolveOrganizationId === null
  ) {
    outcome =
      "NO_ELIGIBLE_ORGANIZATION_ACCESS";
  } else {
    outcome = "ACTOR_RESOLVABLE";
  }

  return NextResponse.json(
    {
      ok: true,

      runtime: {
        authenticated: true,
        clerkUserFingerprint:
          fingerprint(clerkUserId),
        selectedOrganizationPresent:
          selectedClerkOrgId !== null,
        selectedOrganizationFingerprint:
          fingerprint(selectedClerkOrgId),
        selectedOrganizationRole:
          orgRole ?? null,
        emailPresent:
          email !== null,
        emailFingerprint:
          fingerprint(email),
      },

      database: {
        directClerkUserMatch:
          directUser !== null,

        emailMatchCount:
          emailUsers.length,

        emailMatches:
          emailUsers.map((user) => ({
            databaseUserId: user.id,
            clerkBindingPresent:
              user.clerkId !== null,
            clerkFingerprint:
              fingerprint(user.clerkId),
            primaryOrganizationId:
              user.organizationId,
            memberships:
              user.memberships.map(
                (membership) => ({
                  organizationId:
                    membership.organizationId,
                  role: membership.role,
                }),
              ),
          })),

        resolvedDatabaseUser:
          resolvedUser
            ? {
                id: resolvedUser.id,
                directClerkBinding:
                  directUser !== null,
                clerkBindingPresent:
                  resolvedUser.clerkId !== null,
                clerkFingerprint:
                  fingerprint(
                    resolvedUser.clerkId,
                  ),
                primaryOrganizationId:
                  resolvedUser.organizationId,
                memberships:
                  resolvedUser.memberships.map(
                    (membership) => ({
                      organizationId:
                        membership.organizationId,
                      role: membership.role,
                    }),
                  ),
              }
            : null,

        selectedClerkOrganizationMapped:
          selectedOrganization !== null,

        selectedOrganization:
          selectedOrganization
            ? {
                databaseOrganizationId:
                  selectedOrganization.id,
                clerkFingerprint:
                  fingerprint(
                    selectedOrganization.clerkOrgId,
                  ),
              }
            : null,

        eligibleMemberships:
          eligibleMemberships.map(
            (membership) => ({
              organizationId:
                membership.organizationId,
              role: membership.role,
            }),
          ),
      },

      resolution: {
        outcome,
        stage: resolutionStage,
        wouldResolveOrganizationId,
      },

      safety: {
        method: "GET",
        actorResolverInvoked: false,
        identityClaimInvoked: false,
        provisioningInvoked: false,
        databaseReadsOnly: true,
        databaseWrites: false,
        clerkBackendApiRequest: false,
        clerkMutation: false,
      },

      rawIdentifiersReturned: false,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
