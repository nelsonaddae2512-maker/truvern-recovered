import {
  provisioningReadAdapterDependencies,
  readClerkOrganizationCreatedByUserId,
  readExistingTruvernOrganizationRole,
  readVerifiedClerkOrganizationMembership,
} from "@/lib/auth/organization-provisioning-read-adapters";

import {
  verifyOrganizationProvisioning,
  type OrganizationProvisioningVerificationDependencies,
} from "@/lib/auth/organization-provisioning-verification";

export function createOrganizationProvisioningVerificationDependencies():
  OrganizationProvisioningVerificationDependencies {
  return {
    async getClerkMembership(input) {
      return readVerifiedClerkOrganizationMembership(
        input,
        provisioningReadAdapterDependencies,
      );
    },

    async getExistingTruvernRole(input) {
      return readExistingTruvernOrganizationRole(
        input,
        provisioningReadAdapterDependencies,
      );
    },

    async getOrganizationCreatedByUserId(input) {
      return readClerkOrganizationCreatedByUserId(
        input,
        provisioningReadAdapterDependencies,
      );
    },
  };
}

export async function verifyCurrentOrganizationProvisioning(input: {
  authenticatedUserId: string | null;
  selectedOrganizationId: string | null;
  targetOrganizationId: string;
}) {
  return verifyOrganizationProvisioning(
    input,
    createOrganizationProvisioningVerificationDependencies(),
  );
}