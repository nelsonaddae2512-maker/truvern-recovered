import { describe, expect, it, vi } from "vitest";

import {
  verifyOrganizationProvisioning,
  type OrganizationProvisioningVerificationDependencies,
} from "@/lib/auth/organization-provisioning-verification";
import type {
  TruvernCustomerRole,
} from "@/lib/auth/organization-provisioning-policy";

type ExistingTruvernRoleReader = (
  input: {
    authenticatedUserId: string;
    organizationId: string;
  },
) => Promise<TruvernCustomerRole | null>;

function roleReader(
  role: TruvernCustomerRole | null,
): ExistingTruvernRoleReader {
  return async () => role;
}

function dependencies(
  overrides: Partial<OrganizationProvisioningVerificationDependencies> = {},
): OrganizationProvisioningVerificationDependencies {
  return {
    getClerkMembership: vi.fn(async () => ({
      userId: "user-authenticated",
      organizationId: "organization-selected",
      role: "custom-role",
    })),
    getExistingTruvernRole: vi.fn(roleReader("ANALYST")),
    getOrganizationCreatedByUserId: vi.fn(async () => null),
    ...overrides,
  };
}

describe("organization provisioning verification", () => {
  const base = {
    authenticatedUserId: "user-authenticated",
    selectedOrganizationId: "organization-selected",
    targetOrganizationId: "organization-selected",
  };

  it("fails before dependency access when unauthenticated", async () => {
    const deps = dependencies();

    await expect(
      verifyOrganizationProvisioning(
        {
          ...base,
          authenticatedUserId: null,
        },
        deps,
      ),
    ).resolves.toEqual({
      allowed: false,
      reason: "UNAUTHENTICATED",
    });

    expect(deps.getClerkMembership).not.toHaveBeenCalled();
    expect(deps.getExistingTruvernRole).not.toHaveBeenCalled();
  });

  it("fails before dependency access when no organization is selected", async () => {
    const deps = dependencies();

    await expect(
      verifyOrganizationProvisioning(
        {
          ...base,
          selectedOrganizationId: null,
        },
        deps,
      ),
    ).resolves.toEqual({
      allowed: false,
      reason: "NO_SELECTED_ORGANIZATION",
    });

    expect(deps.getClerkMembership).not.toHaveBeenCalled();
    expect(deps.getExistingTruvernRole).not.toHaveBeenCalled();
  });

  it("fails before dependency access on selected-target mismatch", async () => {
    const deps = dependencies();

    await expect(
      verifyOrganizationProvisioning(
        {
          ...base,
          targetOrganizationId: "organization-other",
        },
        deps,
      ),
    ).resolves.toEqual({
      allowed: false,
      reason: "ORGANIZATION_MISMATCH",
    });

    expect(deps.getClerkMembership).not.toHaveBeenCalled();
    expect(deps.getExistingTruvernRole).not.toHaveBeenCalled();
  });

  it("requires a verified Clerk organization membership", async () => {
    const deps = dependencies({
      getClerkMembership: vi.fn(async () => null),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: false,
      reason: "MEMBERSHIP_REQUIRED",
    });

    expect(deps.getExistingTruvernRole).not.toHaveBeenCalled();
  });

  it("rejects a Clerk membership for another user before database role lookup", async () => {
    const deps = dependencies({
      getClerkMembership: vi.fn(async () => ({
        userId: "user-other",
        organizationId: "organization-selected",
        role: "custom-role",
      })),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: false,
      reason: "MEMBERSHIP_USER_MISMATCH",
    });

    expect(deps.getExistingTruvernRole).not.toHaveBeenCalled();
  });

  it("rejects a Clerk membership for another organization before database role lookup", async () => {
    const deps = dependencies({
      getClerkMembership: vi.fn(async () => ({
        userId: "user-authenticated",
        organizationId: "organization-other",
        role: "custom-role",
      })),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: false,
      reason: "MEMBERSHIP_ORGANIZATION_MISMATCH",
    });

    expect(deps.getExistingTruvernRole).not.toHaveBeenCalled();
  });

  it("fails closed for a valid Clerk member with no existing Truvern role", async () => {
    const deps = dependencies({
      getExistingTruvernRole: vi.fn(async () => null),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: false,
      reason: "ROLE_MAPPING_REQUIRED",
    });
  });

  it("provisions the verified organization creator as OWNER when no Truvern role exists", async () => {
    const deps = dependencies({
      getExistingTruvernRole: vi.fn(async () => null),
      getOrganizationCreatedByUserId: vi.fn(
        async () => "user-authenticated",
      ),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: true,
      role: "OWNER",
    });

    expect(
      deps.getOrganizationCreatedByUserId,
    ).toHaveBeenCalledTimes(1);

    expect(
      deps.getOrganizationCreatedByUserId,
    ).toHaveBeenCalledWith({
      organizationId: "organization-selected",
    });
  });

  it("fails closed for a verified non-creator when no Truvern role exists", async () => {
    const deps = dependencies({
      getExistingTruvernRole: vi.fn(async () => null),
      getOrganizationCreatedByUserId: vi.fn(
        async () => "user-other",
      ),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: false,
      reason: "ROLE_MAPPING_REQUIRED",
    });
  });

  it("does not query organization creator before Clerk membership verification succeeds", async () => {
    const deps = dependencies({
      getClerkMembership: vi.fn(async () => null),
      getExistingTruvernRole: vi.fn(async () => null),
      getOrganizationCreatedByUserId: vi.fn(
        async () => "user-authenticated",
      ),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: false,
      reason: "MEMBERSHIP_REQUIRED",
    });

    expect(
      deps.getExistingTruvernRole,
    ).not.toHaveBeenCalled();

    expect(
      deps.getOrganizationCreatedByUserId,
    ).not.toHaveBeenCalled();
  });

  it("preserves an existing VIEWER role even when the verified member created the organization", async () => {
    const deps = dependencies({
      getExistingTruvernRole: vi.fn(roleReader("VIEWER")),
      getOrganizationCreatedByUserId: vi.fn(
        async () => "user-authenticated",
      ),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: true,
      role: "VIEWER",
    });
  });
  it("preserves an existing VIEWER role", async () => {
    const deps = dependencies({
      getExistingTruvernRole: vi.fn(roleReader("VIEWER")),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: true,
      role: "VIEWER",
    });
  });

  it("preserves an existing ANALYST role", async () => {
    const deps = dependencies({
      getExistingTruvernRole: vi.fn(roleReader("ANALYST")),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: true,
      role: "ANALYST",
    });
  });

  it("preserves an existing ADMIN role", async () => {
    const deps = dependencies({
      getExistingTruvernRole: vi.fn(roleReader("ADMIN")),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: true,
      role: "ADMIN",
    });
  });

  it("preserves an existing OWNER role", async () => {
    const deps = dependencies({
      getExistingTruvernRole: vi.fn(roleReader("OWNER")),
    });

    await expect(
      verifyOrganizationProvisioning(base, deps),
    ).resolves.toEqual({
      allowed: true,
      role: "OWNER",
    });
  });

  it("queries both dependencies only with the authenticated user and target organization", async () => {
    const deps = dependencies();

    await verifyOrganizationProvisioning(base, deps);

    expect(deps.getClerkMembership).toHaveBeenCalledTimes(1);
    expect(deps.getClerkMembership).toHaveBeenCalledWith({
      authenticatedUserId: "user-authenticated",
      organizationId: "organization-selected",
    });

    expect(deps.getExistingTruvernRole).toHaveBeenCalledTimes(1);
    expect(deps.getExistingTruvernRole).toHaveBeenCalledWith({
      authenticatedUserId: "user-authenticated",
      organizationId: "organization-selected",
    });
  });
});
