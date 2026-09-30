import { describe, expect, it } from "vitest";

import {
  decideOrganizationProvisioning,
  type OrganizationProvisioningInput,
} from "@/lib/auth/organization-provisioning-policy";

describe("organization provisioning security policy", () => {
  const base: OrganizationProvisioningInput = {
    authenticatedUserId: "user-authenticated",
    selectedOrganizationId: "organization-selected",
    targetOrganizationId: "organization-selected",
    clerkMembership: {
      userId: "user-authenticated",
      organizationId: "organization-selected",
      role: "custom-role",
    },
    existingRole: null,
    organizationCreatedByUserId: null,
  };

  it("fails closed when there is no authenticated user", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        authenticatedUserId: null,
      }),
    ).toEqual({
      allowed: false,
      reason: "UNAUTHENTICATED",
    });
  });

  it("fails closed when there is no selected Clerk organization", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        selectedOrganizationId: null,
      }),
    ).toEqual({
      allowed: false,
      reason: "NO_SELECTED_ORGANIZATION",
    });
  });

  it("rejects provisioning into a different organization", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        targetOrganizationId: "organization-other",
      }),
    ).toEqual({
      allowed: false,
      reason: "ORGANIZATION_MISMATCH",
    });
  });

  it("requires verified Clerk organization membership", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        clerkMembership: null,
      }),
    ).toEqual({
      allowed: false,
      reason: "MEMBERSHIP_REQUIRED",
    });
  });

  it("rejects membership belonging to another Clerk user", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        clerkMembership: {
          ...base.clerkMembership!,
          userId: "user-other",
        },
      }),
    ).toEqual({
      allowed: false,
      reason: "MEMBERSHIP_USER_MISMATCH",
    });
  });

  it("rejects membership belonging to another organization", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        clerkMembership: {
          ...base.clerkMembership!,
          organizationId: "organization-other",
        },
      }),
    ).toEqual({
      allowed: false,
      reason: "MEMBERSHIP_ORGANIZATION_MISMATCH",
    });
  });

  it("does not infer a Truvern governance role from an unknown Clerk role", () => {
    expect(
      decideOrganizationProvisioning(base),
    ).toEqual({
      allowed: false,
      reason: "ROLE_MAPPING_REQUIRED",
    });
  });

  it("provisions the verified organization creator as OWNER", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        organizationCreatedByUserId:
          "user-authenticated",
      }),
    ).toEqual({
      allowed: true,
      role: "OWNER",
    });
  });

  it("does not grant OWNER when the organization creator is another user", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        organizationCreatedByUserId:
          "user-other",
      }),
    ).toEqual({
      allowed: false,
      reason: "ROLE_MAPPING_REQUIRED",
    });
  });

  it("does not let creator identity bypass Clerk membership validation", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        clerkMembership: null,
        organizationCreatedByUserId:
          "user-authenticated",
      }),
    ).toEqual({
      allowed: false,
      reason: "MEMBERSHIP_REQUIRED",
    });
  });

  it("preserves an existing role instead of elevating it from creator status", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        existingRole: "VIEWER",
        organizationCreatedByUserId:
          "user-authenticated",
      }),
    ).toEqual({
      allowed: true,
      role: "VIEWER",
    });
  });
  it("preserves an existing VIEWER membership without elevation", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        existingRole: "VIEWER",
      }),
    ).toEqual({
      allowed: true,
      role: "VIEWER",
    });
  });

  it("preserves an existing ANALYST membership without elevation", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        existingRole: "ANALYST",
      }),
    ).toEqual({
      allowed: true,
      role: "ANALYST",
    });
  });

  it("preserves an existing ADMIN membership without elevation", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        existingRole: "ADMIN",
      }),
    ).toEqual({
      allowed: true,
      role: "ADMIN",
    });
  });

  it("preserves an existing OWNER membership without elevation", () => {
    expect(
      decideOrganizationProvisioning({
        ...base,
        existingRole: "OWNER",
      }),
    ).toEqual({
      allowed: true,
      role: "OWNER",
    });
  });

  it("maps verified Clerk org:admin to Truvern ADMIN", () => {
    expect(
      decideOrganizationProvisioning({
        authenticatedUserId: "user_1",
        selectedOrganizationId: "org_1",
        targetOrganizationId: "org_1",
        clerkMembership: {
          userId: "user_1",
          organizationId: "org_1",
          role: "org:admin",
        },
        existingRole: null,
        organizationCreatedByUserId: "user_other",
      }),
    ).toEqual({
      allowed: true,
      role: "ADMIN",
    });
  });

  it("keeps verified Clerk org:member fail closed", () => {
    expect(
      decideOrganizationProvisioning({
        authenticatedUserId: "user_1",
        selectedOrganizationId: "org_1",
        targetOrganizationId: "org_1",
        clerkMembership: {
          userId: "user_1",
          organizationId: "org_1",
          role: "org:member",
        },
        existingRole: null,
        organizationCreatedByUserId: "user_other",
      }),
    ).toEqual({
      allowed: false,
      reason: "ROLE_MAPPING_REQUIRED",
    });
  });

  it("keeps unknown Clerk organization roles fail closed", () => {
    expect(
      decideOrganizationProvisioning({
        authenticatedUserId: "user_1",
        selectedOrganizationId: "org_1",
        targetOrganizationId: "org_1",
        clerkMembership: {
          userId: "user_1",
          organizationId: "org_1",
          role: "org:custom-security-reviewer",
        },
        existingRole: null,
        organizationCreatedByUserId: "user_other",
      }),
    ).toEqual({
      allowed: false,
      reason: "ROLE_MAPPING_REQUIRED",
    });
  });

  it("preserves an existing Truvern role ahead of Clerk org:admin mapping", () => {
    expect(
      decideOrganizationProvisioning({
        authenticatedUserId: "user_1",
        selectedOrganizationId: "org_1",
        targetOrganizationId: "org_1",
        clerkMembership: {
          userId: "user_1",
          organizationId: "org_1",
          role: "org:admin",
        },
        existingRole: "VIEWER",
        organizationCreatedByUserId: "user_other",
      }),
    ).toEqual({
      allowed: true,
      role: "VIEWER",
    });
  });

  it("keeps verified organization creator OWNER ahead of Clerk org:admin mapping", () => {
    expect(
      decideOrganizationProvisioning({
        authenticatedUserId: "user_1",
        selectedOrganizationId: "org_1",
        targetOrganizationId: "org_1",
        clerkMembership: {
          userId: "user_1",
          organizationId: "org_1",
          role: "org:admin",
        },
        existingRole: null,
        organizationCreatedByUserId: "user_1",
      }),
    ).toEqual({
      allowed: true,
      role: "OWNER",
    });
  });});