export type TruvernCustomerRole =
  | "OWNER"
  | "ADMIN"
  | "ANALYST"
  | "VIEWER";

export type OrganizationProvisioningInput = {
  authenticatedUserId: string | null;
  selectedOrganizationId: string | null;
  targetOrganizationId: string;
  clerkMembership:
    | {
        userId: string;
        organizationId: string;
        role: string;
      }
    | null;
  existingRole: TruvernCustomerRole | null;
  organizationCreatedByUserId: string | null;
};

export type OrganizationProvisioningDecision =
  | {
      allowed: false;
      reason:
        | "UNAUTHENTICATED"
        | "NO_SELECTED_ORGANIZATION"
        | "ORGANIZATION_MISMATCH"
        | "MEMBERSHIP_REQUIRED"
        | "MEMBERSHIP_USER_MISMATCH"
        | "MEMBERSHIP_ORGANIZATION_MISMATCH"
        | "ROLE_MAPPING_REQUIRED";
    }
  | {
      allowed: true;
      role: TruvernCustomerRole;
    };

/**
 * Pure authorization policy for organization provisioning.
 *
 * This function performs no database, Clerk, network, assessment,
 * email, or other external I/O.
 *
 * Existing Truvern memberships may be preserved but never elevated.
 * New memberships fail closed until an explicit Clerk-to-Truvern
 * role mapping is established by separate policy.
 */
export function decideOrganizationProvisioning(
  input: OrganizationProvisioningInput,
): OrganizationProvisioningDecision {
  if (!input.authenticatedUserId) {
    return {
      allowed: false,
      reason: "UNAUTHENTICATED",
    };
  }

  if (!input.selectedOrganizationId) {
    return {
      allowed: false,
      reason: "NO_SELECTED_ORGANIZATION",
    };
  }

  if (
    input.selectedOrganizationId !==
    input.targetOrganizationId
  ) {
    return {
      allowed: false,
      reason: "ORGANIZATION_MISMATCH",
    };
  }

  if (!input.clerkMembership) {
    return {
      allowed: false,
      reason: "MEMBERSHIP_REQUIRED",
    };
  }

  if (
    input.clerkMembership.userId !==
    input.authenticatedUserId
  ) {
    return {
      allowed: false,
      reason: "MEMBERSHIP_USER_MISMATCH",
    };
  }

  if (
    input.clerkMembership.organizationId !==
    input.targetOrganizationId
  ) {
    return {
      allowed: false,
      reason: "MEMBERSHIP_ORGANIZATION_MISMATCH",
    };
  }

  if (input.existingRole) {
    return {
      allowed: true,
      role: input.existingRole,
    };
  }

  if (
    input.organizationCreatedByUserId ===
    input.authenticatedUserId
  ) {
    return {
      allowed: true,
      role: "OWNER",
    };
  }

  /*
   * Explicit Clerk-to-Truvern role mapping.
   *
   * Clerk organization administrators receive Truvern ADMIN authority.
   * Ownership remains reserved for the verified organization creator
   * rule above. All other unmapped/custom Clerk roles continue to fail
   * closed.
   */
  if (input.clerkMembership.role === "org:admin") {
    return {
      allowed: true,
      role: "ADMIN",
    };
  }

  return {
    allowed: false,
    reason: "ROLE_MAPPING_REQUIRED",
  };
}