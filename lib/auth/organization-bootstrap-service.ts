import type { OrgRole } from "@prisma/client";
import {
  createBootstrapUser,
} from "@/lib/auth/organization-bootstrap-adapters";

import {
  provisionCurrentOrganization,
  type ProvisionCurrentOrganizationResult,
} from "@/lib/auth/organization-provisioning-service";

export type BootstrapCurrentOrganizationInput = {
  authenticatedUserId: string | null;
  selectedOrganizationId: string | null;
  targetOrganizationId: string;
  authenticatedEmail: string | null;
};

export type BootstrapVerifiedIdentity = {
  role: OrgRole;
  organizationName: string;
};

export type BootstrapUserResolution =
  | {
      ok: true;
      userId: number;
      claimed: boolean;
    }
  | {
      ok: false;
      reason:
        | "USER_NOT_PROVISIONED"
        | "USER_IDENTITY_CONFLICT";
    };

export type BootstrapOrganizationResolution =
  | {
      ok: true;
      organizationId: number;
      created: boolean;
    }
  | {
      ok: false;
      reason:
        | "ORGANIZATION_BOOTSTRAP_FAILED"
        | "ORGANIZATION_IDENTITY_CONFLICT";
    };

export type BootstrapCurrentOrganizationResult =
  | {
      ok: true;
      userId: number;
      organizationId: number;
      role: OrgRole;
      userClaimed: boolean;
      organizationCreated: boolean;
      membershipCreated: boolean;
      primaryOrganizationUpdated: boolean;
    }
  | {
      ok: false;
      reason: string;
    };

type BootstrapDependencies = {
  verifyIdentity: (input: {
    authenticatedUserId: string;
    selectedOrganizationId: string;
    targetOrganizationId: string;
  }) => Promise<
    | {
        allowed: true;
        role: OrgRole;
        organizationName: string;
      }
    | {
        allowed: false;
        reason: string;
      }
  >;

  resolveUser: (input: {
    clerkUserId: string;
    email: string;
  }) => Promise<BootstrapUserResolution>;
  createUser?: (input: {
    clerkUserId: string;
    email: string;
  }) => Promise<BootstrapUserResolution>;

  resolveOrganization: (input: {
    clerkOrganizationId: string;
    organizationName: string;
  }) => Promise<BootstrapOrganizationResolution>;

  provision?: (input: {
    authenticatedUserId: string | null;
    selectedOrganizationId: string | null;
    targetOrganizationId: string;
  }) => Promise<ProvisionCurrentOrganizationResult>;
};

/*
 * Explicit first-binding orchestration only.
 *
 * This service does not read Clerk directly and does not write Prisma
 * directly. Authentication/membership verification and first-binding
 * persistence remain separate dependencies so that each boundary can
 * be certified independently.
 *
 * resolveUser first resolves an exact Clerk binding or atomically
 * claims an already provisioned, unbound Truvern user. Only after
 * successful Clerk identity / organization-membership verification,
 * and only when no provisioned user resolves, may createUser establish
 * the initial Truvern DB identity. Role authority remains separate.
 */
export async function bootstrapCurrentOrganization(
  input: BootstrapCurrentOrganizationInput,
  dependencies: BootstrapDependencies,
): Promise<BootstrapCurrentOrganizationResult> {
  const authenticatedUserId =
    input.authenticatedUserId?.trim() ?? "";

  const selectedOrganizationId =
    input.selectedOrganizationId?.trim() ?? "";

  const targetOrganizationId =
    input.targetOrganizationId.trim();

  const authenticatedEmail =
    input.authenticatedEmail?.trim().toLowerCase() ?? "";

  if (!authenticatedUserId) {
    return {
      ok: false,
      reason: "UNAUTHENTICATED",
    };
  }

  if (!selectedOrganizationId) {
    return {
      ok: false,
      reason: "NO_SELECTED_ORGANIZATION",
    };
  }

  if (
    !targetOrganizationId ||
    selectedOrganizationId !== targetOrganizationId
  ) {
    return {
      ok: false,
      reason: "ORGANIZATION_CONTEXT_MISMATCH",
    };
  }

  if (!authenticatedEmail) {
    return {
      ok: false,
      reason: "AUTHENTICATED_EMAIL_REQUIRED",
    };
  }

  const verification =
    await dependencies.verifyIdentity({
      authenticatedUserId,
      selectedOrganizationId,
      targetOrganizationId,
    });

  if (!verification.allowed) {
    return {
      ok: false,
      reason: verification.reason,
    };
  }

  let user =
    await dependencies.resolveUser({
      clerkUserId: authenticatedUserId,
      email: authenticatedEmail,
    });

  if (
    !user.ok &&
    user.reason === "USER_NOT_PROVISIONED"
  ) {
    const createUser =
      dependencies.createUser ??
      createBootstrapUser;

    user =
      await createUser({
        clerkUserId: authenticatedUserId,
        email: authenticatedEmail,
      });
  }

  if (!user.ok) {
    return user;
  }

  const organization =
    await dependencies.resolveOrganization({
      clerkOrganizationId: targetOrganizationId,
      organizationName: verification.organizationName,
    });

  if (!organization.ok) {
    return organization;
  }

  const provision =
    dependencies.provision ??
    provisionCurrentOrganization;

  const provisioned =
    await provision({
      authenticatedUserId,
      selectedOrganizationId,
      targetOrganizationId,
    });

  if (!provisioned.ok) {
    return {
      ok: false,
      reason: provisioned.reason,
    };
  }

  /*
   * Defense in depth:
   *
   * The exact identities resolved by bootstrap must be the same
   * identities subsequently used by the certified provisioning
   * persistence layer.
   */
  if (
    provisioned.userId !== user.userId ||
    provisioned.organizationId !==
      organization.organizationId
  ) {
    return {
      ok: false,
      reason: "BOOTSTRAP_IDENTITY_INVARIANT_VIOLATION",
    };
  }

  return {
    ok: true,
    userId: provisioned.userId,
    organizationId: provisioned.organizationId,
    role: provisioned.role,
    userClaimed: user.claimed,
    organizationCreated: organization.created,
    membershipCreated: provisioned.membershipCreated,
    primaryOrganizationUpdated:
      provisioned.primaryOrganizationUpdated,
  };
}