import {
  decideOrganizationProvisioning,
  type OrganizationProvisioningDecision,
  type TruvernCustomerRole,
} from "@/lib/auth/organization-provisioning-policy";

export type ClerkOrganizationMembershipSnapshot = {
  userId: string;
  organizationId: string;
  role: string;
};

export type OrganizationProvisioningVerificationDependencies = {
  getClerkMembership: (input: {
    authenticatedUserId: string;
    organizationId: string;
  }) => Promise<ClerkOrganizationMembershipSnapshot | null>;

  getExistingTruvernRole: (input: {
    authenticatedUserId: string;
    organizationId: string;
  }) => Promise<TruvernCustomerRole | null>;

  getOrganizationCreatedByUserId: (input: {
    organizationId: string;
  }) => Promise<string | null>;
};

export type VerifyOrganizationProvisioningInput = {
  authenticatedUserId: string | null;
  selectedOrganizationId: string | null;
  targetOrganizationId: string;
};

export type OrganizationProvisioningVerificationResult =
  OrganizationProvisioningDecision;

/**
 * Verifies whether an authenticated Clerk organization relationship
 * is already safe to use as a Truvern organization relationship.
 *
 * This service is deliberately read-only.
 *
 * It does not:
 * - create or update a database user;
 * - create or update an organization;
 * - create or update an OrgMembership;
 * - change a Truvern role;
 * - send an assessment or email;
 * - perform any other write.
 *
 * A new membership without an established Truvern role fails closed
 * through ROLE_MAPPING_REQUIRED.
 */
export async function verifyOrganizationProvisioning(
  input: VerifyOrganizationProvisioningInput,
  dependencies: OrganizationProvisioningVerificationDependencies,
): Promise<OrganizationProvisioningVerificationResult> {
  if (!input.authenticatedUserId) {
    return decideOrganizationProvisioning({
      authenticatedUserId: null,
      selectedOrganizationId: input.selectedOrganizationId,
      targetOrganizationId: input.targetOrganizationId,
      clerkMembership: null,
      existingRole: null,
      organizationCreatedByUserId: null,
    });
  }

  if (!input.selectedOrganizationId) {
    return decideOrganizationProvisioning({
      authenticatedUserId: input.authenticatedUserId,
      selectedOrganizationId: null,
      targetOrganizationId: input.targetOrganizationId,
      clerkMembership: null,
      existingRole: null,
      organizationCreatedByUserId: null,
    });
  }

  if (
    input.selectedOrganizationId !==
    input.targetOrganizationId
  ) {
    return decideOrganizationProvisioning({
      authenticatedUserId: input.authenticatedUserId,
      selectedOrganizationId: input.selectedOrganizationId,
      targetOrganizationId: input.targetOrganizationId,
      clerkMembership: null,
      existingRole: null,
      organizationCreatedByUserId: null,
    });
  }

  const clerkMembership =
    await dependencies.getClerkMembership({
      authenticatedUserId: input.authenticatedUserId,
      organizationId: input.targetOrganizationId,
    });

  if (!clerkMembership) {
    return decideOrganizationProvisioning({
      authenticatedUserId: input.authenticatedUserId,
      selectedOrganizationId: input.selectedOrganizationId,
      targetOrganizationId: input.targetOrganizationId,
      clerkMembership: null,
      existingRole: null,
      organizationCreatedByUserId: null,
    });
  }

  /*
   * Validate the Clerk relationship before consulting the database
   * role. This prevents a pre-existing database membership from
   * bypassing Clerk identity or organization boundaries.
   */
  const clerkRelationshipDecision =
    decideOrganizationProvisioning({
      authenticatedUserId: input.authenticatedUserId,
      selectedOrganizationId: input.selectedOrganizationId,
      targetOrganizationId: input.targetOrganizationId,
      clerkMembership,
      existingRole: null,
      organizationCreatedByUserId: null,
    });

  if (
    !clerkRelationshipDecision.allowed &&
    clerkRelationshipDecision.reason !==
      "ROLE_MAPPING_REQUIRED"
  ) {
    return clerkRelationshipDecision;
  }

  const existingRole =
    await dependencies.getExistingTruvernRole({
      authenticatedUserId: input.authenticatedUserId,
      organizationId: input.targetOrganizationId,
    });

  const organizationCreatedByUserId =
    await dependencies.getOrganizationCreatedByUserId({
      organizationId: input.targetOrganizationId,
    });

  return decideOrganizationProvisioning({
    authenticatedUserId: input.authenticatedUserId,
    selectedOrganizationId: input.selectedOrganizationId,
    targetOrganizationId: input.targetOrganizationId,
    clerkMembership,
    existingRole,
    organizationCreatedByUserId,
  });
}
