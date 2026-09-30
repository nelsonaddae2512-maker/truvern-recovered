import type { OrgRole } from "@prisma/client";

import {
  persistVerifiedOrganizationProvisioning,
  type OrganizationProvisioningPersistenceResult,
} from "@/lib/auth/organization-provisioning-persistence";

import {
  verifyCurrentOrganizationProvisioning,
} from "@/lib/auth/organization-provisioning-verifier";

export type ProvisionCurrentOrganizationInput = {
  authenticatedUserId: string | null;
  selectedOrganizationId: string | null;
  targetOrganizationId: string;
};

export type ProvisionCurrentOrganizationResult =
  | OrganizationProvisioningPersistenceResult
  | {
      ok: false;
      reason: string;
    };

type VerificationDecision =
  | {
      allowed: true;
      role: OrgRole;
    }
  | {
      allowed: false;
      reason: string;
    };

export async function provisionCurrentOrganization(
  input: ProvisionCurrentOrganizationInput,
  dependencies: {
    verify?: (
      input: ProvisionCurrentOrganizationInput,
    ) => Promise<VerificationDecision>;
    persist?: (input: {
      clerkUserId: string;
      clerkOrganizationId: string;
      authorizedRole: OrgRole;
    }) => Promise<OrganizationProvisioningPersistenceResult>;
  } = {},
): Promise<ProvisionCurrentOrganizationResult> {
  const verify =
    dependencies.verify ??
    verifyCurrentOrganizationProvisioning;

  const persist =
    dependencies.persist ??
    persistVerifiedOrganizationProvisioning;

  const decision =
    await verify(input);

  if (!decision.allowed) {
    return {
      ok: false,
      reason: decision.reason,
    };
  }

  /*
   * An allowed verification decision can only be reached after
   * authentication, selected-organization presence, exact
   * selected/target equality, and verified Clerk membership.
   *
   * Keep the checks explicit here as a defense-in-depth boundary
   * before any persistence operation.
   */
  if (
    !input.authenticatedUserId ||
    !input.selectedOrganizationId ||
    input.selectedOrganizationId !==
      input.targetOrganizationId
  ) {
    return {
      ok: false,
      reason: "VERIFICATION_INVARIANT_VIOLATION",
    };
  }

  return persist({
    clerkUserId: input.authenticatedUserId,
    clerkOrganizationId:
      input.targetOrganizationId,
    authorizedRole: decision.role,
  });
}