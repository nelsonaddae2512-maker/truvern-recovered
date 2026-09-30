import { describe, expect, it, vi } from "vitest";

import {
  readExistingTruvernOrganizationRole,
  readVerifiedClerkOrganizationMembership,
  type ProvisioningReadAdapterDependencies,
} from "@/lib/auth/organization-provisioning-read-adapters";

function dependencies(
  overrides: Partial<ProvisioningReadAdapterDependencies> = {},
): ProvisioningReadAdapterDependencies {
  return {
    getClerkMembershipList: vi.fn(async () => []),
    getClerkOrganization: vi.fn(async () => null),
    findDatabaseUser: vi.fn(async () => null),
    findDatabaseOrganization: vi.fn(async () => null),
    findDatabaseMembership: vi.fn(async () => null),
    ...overrides,
  };
}

describe("organization provisioning read adapters", () => {
  it("queries Clerk with the exact organization and user", async () => {
    const getClerkMembershipList =
      vi.fn(async () => [
        {
          userId: "user-1",
          organizationId: "org-1",
          role: "org:member",
        },
      ]);

    const result =
      await readVerifiedClerkOrganizationMembership(
        {
          authenticatedUserId: "user-1",
          organizationId: "org-1",
        },
        {
          getClerkMembershipList,
        },
      );

    expect(getClerkMembershipList).toHaveBeenCalledTimes(1);
    expect(getClerkMembershipList).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      userId: "user-1",
      organizationId: "org-1",
      role: "org:member",
    });
  });

  it("rejects a Clerk membership for another user", async () => {
    await expect(
      readVerifiedClerkOrganizationMembership(
        {
          authenticatedUserId: "user-1",
          organizationId: "org-1",
        },
        {
          getClerkMembershipList: vi.fn(async () => [
            {
              userId: "user-2",
              organizationId: "org-1",
              role: "org:member",
            },
          ]),
        },
      ),
    ).resolves.toBeNull();
  });

  it("rejects a Clerk membership for another organization", async () => {
    await expect(
      readVerifiedClerkOrganizationMembership(
        {
          authenticatedUserId: "user-1",
          organizationId: "org-1",
        },
        {
          getClerkMembershipList: vi.fn(async () => [
            {
              userId: "user-1",
              organizationId: "org-2",
              role: "org:member",
            },
          ]),
        },
      ),
    ).resolves.toBeNull();
  });

  it("fails closed when Clerk returns no membership", async () => {
    await expect(
      readVerifiedClerkOrganizationMembership(
        {
          authenticatedUserId: "user-1",
          organizationId: "org-1",
        },
        {
          getClerkMembershipList: vi.fn(async () => []),
        },
      ),
    ).resolves.toBeNull();
  });

  it("fails closed when Clerk returns duplicate exact memberships", async () => {
    const membership = {
      userId: "user-1",
      organizationId: "org-1",
      role: "org:member",
    };

    await expect(
      readVerifiedClerkOrganizationMembership(
        {
          authenticatedUserId: "user-1",
          organizationId: "org-1",
        },
        {
          getClerkMembershipList: vi.fn(async () => [
            membership,
            membership,
          ]),
        },
      ),
    ).resolves.toBeNull();
  });

  it("reads the exact database membership without fallback", async () => {
    const findDatabaseUser =
      vi.fn(async () => ({
        id: 7,
      }));

    const findDatabaseOrganization =
      vi.fn(async () => ({
        id: 13,
      }));

    const findDatabaseMembership =
      vi.fn(async () => ({
        role: "ANALYST",
      }));

    await expect(
      readExistingTruvernOrganizationRole(
        {
          authenticatedUserId: "user-1",
          organizationId: "org-1",
        },
        {
          findDatabaseUser,
          findDatabaseOrganization,
          findDatabaseMembership,
        },
      ),
    ).resolves.toBe("ANALYST");

    expect(findDatabaseUser).toHaveBeenCalledWith({
      clerkUserId: "user-1",
    });

    expect(findDatabaseOrganization).toHaveBeenCalledWith({
      clerkOrganizationId: "org-1",
    });

    expect(findDatabaseMembership).toHaveBeenCalledWith({
      userId: 7,
      organizationId: 13,
    });
  });

  it("stops before organization lookup when the database user is absent", async () => {
    const deps = dependencies();

    await expect(
      readExistingTruvernOrganizationRole(
        {
          authenticatedUserId: "user-1",
          organizationId: "org-1",
        },
        deps,
      ),
    ).resolves.toBeNull();

    expect(deps.findDatabaseUser).toHaveBeenCalledTimes(1);
    expect(deps.findDatabaseOrganization).not.toHaveBeenCalled();
    expect(deps.findDatabaseMembership).not.toHaveBeenCalled();
  });

  it("stops before membership lookup when the database organization is absent", async () => {
    const deps =
      dependencies({
        findDatabaseUser: vi.fn(async () => ({
          id: 7,
        })),
      });

    await expect(
      readExistingTruvernOrganizationRole(
        {
          authenticatedUserId: "user-1",
          organizationId: "org-1",
        },
        deps,
      ),
    ).resolves.toBeNull();

    expect(deps.findDatabaseMembership).not.toHaveBeenCalled();
  });

  it("returns null when the exact database membership is absent", async () => {
    const deps =
      dependencies({
        findDatabaseUser: vi.fn(async () => ({
          id: 7,
        })),
        findDatabaseOrganization: vi.fn(async () => ({
          id: 13,
        })),
      });

    await expect(
      readExistingTruvernOrganizationRole(
        {
          authenticatedUserId: "user-1",
          organizationId: "org-1",
        },
        deps,
      ),
    ).resolves.toBeNull();
  });

  it.each([
    "VIEWER",
    "ANALYST",
    "ADMIN",
    "OWNER",
  ] as const)(
    "preserves the existing %s role",
    async (role) => {
      await expect(
        readExistingTruvernOrganizationRole(
          {
            authenticatedUserId: "user-1",
            organizationId: "org-1",
          },
          {
            findDatabaseUser: vi.fn(async () => ({
              id: 7,
            })),
            findDatabaseOrganization: vi.fn(async () => ({
              id: 13,
            })),
            findDatabaseMembership: vi.fn(async () => ({
              role,
            })),
          },
        ),
      ).resolves.toBe(role);
    },
  );

  it("rejects a non-customer database role", async () => {
    await expect(
      readExistingTruvernOrganizationRole(
        {
          authenticatedUserId: "user-1",
          organizationId: "org-1",
        },
        {
          findDatabaseUser: vi.fn(async () => ({
            id: 7,
          })),
          findDatabaseOrganization: vi.fn(async () => ({
            id: 13,
          })),
          findDatabaseMembership: vi.fn(async () => ({
            role: "VENDOR",
          })),
        },
      ),
    ).resolves.toBeNull();
  });
});
