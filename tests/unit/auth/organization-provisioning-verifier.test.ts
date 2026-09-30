import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(
  "@/lib/auth/organization-provisioning-read-adapters",
  () => ({
    provisioningReadAdapterDependencies: {
      getClerkMembershipList: vi.fn(),
      findDatabaseUser: vi.fn(),
      findDatabaseOrganization: vi.fn(),
      findDatabaseMembership: vi.fn(),
    },

    readVerifiedClerkOrganizationMembership:
      vi.fn(),

    readExistingTruvernOrganizationRole:
      vi.fn(),

    readClerkOrganizationCreatedByUserId:
      vi.fn(),
  }),
);

import {
  readClerkOrganizationCreatedByUserId,
  readExistingTruvernOrganizationRole,
  readVerifiedClerkOrganizationMembership,
} from "@/lib/auth/organization-provisioning-read-adapters";

import {
  createOrganizationProvisioningVerificationDependencies,
  verifyCurrentOrganizationProvisioning,
} from "@/lib/auth/organization-provisioning-verifier";

const clerkReader =
  vi.mocked(
    readVerifiedClerkOrganizationMembership,
  );

const roleReader =
  vi.mocked(
    readExistingTruvernOrganizationRole,
  );

const creatorReader =
  vi.mocked(
    readClerkOrganizationCreatedByUserId,
  );

describe("organization provisioning verifier composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    creatorReader.mockResolvedValue(null);
  });

  it("exposes the three verification dependencies", () => {
    const dependencies =
      createOrganizationProvisioningVerificationDependencies();

    expect(
      typeof dependencies.getClerkMembership,
    ).toBe("function");

    expect(
      typeof dependencies.getExistingTruvernRole,
    ).toBe("function");

    expect(
      typeof dependencies.getOrganizationCreatedByUserId,
    ).toBe("function");
  });

  it("does not read dependencies when unauthenticated", async () => {
    const result =
      await verifyCurrentOrganizationProvisioning({
        authenticatedUserId: null,
        selectedOrganizationId: "org-1",
        targetOrganizationId: "org-1",
      });

    expect(result.allowed).toBe(false);
    expect(clerkReader).not.toHaveBeenCalled();
    expect(roleReader).not.toHaveBeenCalled();
  });

  it("does not read dependencies when no organization is selected", async () => {
    const result =
      await verifyCurrentOrganizationProvisioning({
        authenticatedUserId: "user-1",
        selectedOrganizationId: null,
        targetOrganizationId: "org-1",
      });

    expect(result.allowed).toBe(false);
    expect(clerkReader).not.toHaveBeenCalled();
    expect(roleReader).not.toHaveBeenCalled();
  });

  it("does not read dependencies on selected-target mismatch", async () => {
    const result =
      await verifyCurrentOrganizationProvisioning({
        authenticatedUserId: "user-1",
        selectedOrganizationId: "org-2",
        targetOrganizationId: "org-1",
      });

    expect(result.allowed).toBe(false);
    expect(clerkReader).not.toHaveBeenCalled();
    expect(roleReader).not.toHaveBeenCalled();
  });

  it("fails closed when exact Clerk membership is absent", async () => {
    clerkReader.mockResolvedValue(null);

    const result =
      await verifyCurrentOrganizationProvisioning({
        authenticatedUserId: "user-1",
        selectedOrganizationId: "org-1",
        targetOrganizationId: "org-1",
      });

    expect(result.allowed).toBe(false);

    expect(clerkReader).toHaveBeenCalledWith(
      {
        authenticatedUserId: "user-1",
        organizationId: "org-1",
      },
      expect.anything(),
    );

    expect(roleReader).not.toHaveBeenCalled();
  });

  it("fails closed for a verified Clerk member with no existing Truvern role", async () => {
    clerkReader.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      role: "org:member",
    });

    roleReader.mockResolvedValue(null);

    const result =
      await verifyCurrentOrganizationProvisioning({
        authenticatedUserId: "user-1",
        selectedOrganizationId: "org-1",
        targetOrganizationId: "org-1",
      });

    expect(result.allowed).toBe(false);

    expect(roleReader).toHaveBeenCalledWith(
      {
        authenticatedUserId: "user-1",
        organizationId: "org-1",
      },
      expect.anything(),
    );
  });

  it.each([
    "VIEWER",
    "ANALYST",
    "ADMIN",
    "OWNER",
  ] as const)(
    "preserves verified existing %s role",
    async (role) => {
      clerkReader.mockResolvedValue({
        userId: "user-1",
        organizationId: "org-1",
        role: "org:member",
      });

      roleReader.mockResolvedValue(role);

      const result =
        await verifyCurrentOrganizationProvisioning({
          authenticatedUserId: "user-1",
          selectedOrganizationId: "org-1",
          targetOrganizationId: "org-1",
        });

      expect(result.allowed).toBe(true);

      if (result.allowed) {
        expect(result.role).toBe(role);
      }
    },
  );

  it("passes only the exact identifiers required by each reader", async () => {
    clerkReader.mockResolvedValue({
      userId: "user-77",
      organizationId: "org-13",
      role: "custom-role",
    });

    roleReader.mockResolvedValue("ANALYST");

    await verifyCurrentOrganizationProvisioning({
      authenticatedUserId: "user-77",
      selectedOrganizationId: "org-13",
      targetOrganizationId: "org-13",
    });

    expect(clerkReader).toHaveBeenCalledTimes(1);
    expect(roleReader).toHaveBeenCalledTimes(1);
    expect(creatorReader).toHaveBeenCalledTimes(1);

    expect(clerkReader.mock.calls[0][0]).toEqual({
      authenticatedUserId: "user-77",
      organizationId: "org-13",
    });

    expect(roleReader.mock.calls[0][0]).toEqual({
      authenticatedUserId: "user-77",
      organizationId: "org-13",
    });

    expect(creatorReader.mock.calls[0][0]).toEqual({
      organizationId: "org-13",
    });
  });
});