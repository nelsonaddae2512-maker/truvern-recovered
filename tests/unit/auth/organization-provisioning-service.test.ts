import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  provisionCurrentOrganization,
} from "@/lib/auth/organization-provisioning-service";

function successfulPersistence(
  role:
    | "OWNER"
    | "ADMIN"
    | "ANALYST"
    | "VIEWER" = "OWNER",
) {
  return {
    ok: true as const,
    userId: 77,
    organizationId: 13,
    role,
    membershipCreated: true,
    primaryOrganizationUpdated: true,
  };
}

const baseInput = {
  authenticatedUserId: "user-77",
  selectedOrganizationId: "org-13",
  targetOrganizationId: "org-13",
};

describe(
  "verified organization provisioning service",
  () => {
    it(
      "never persists when verification is denied",
      async () => {
        const verify = vi.fn(async () => ({
          allowed: false as const,
          reason: "MEMBERSHIP_REQUIRED",
        }));

        const persist = vi.fn();

        const result =
          await provisionCurrentOrganization(
            baseInput,
            {
              verify,
              persist,
            },
          );

        expect(result).toEqual({
          ok: false,
          reason: "MEMBERSHIP_REQUIRED",
        });

        expect(persist).not.toHaveBeenCalled();
      },
    );

    it(
      "passes a verified creator OWNER decision unchanged to persistence",
      async () => {
        const verify = vi.fn(async () => ({
          allowed: true as const,
          role: "OWNER" as const,
        }));

        const persist = vi.fn(
          async () =>
            successfulPersistence("OWNER"),
        );

        const result =
          await provisionCurrentOrganization(
            baseInput,
            {
              verify,
              persist,
            },
          );

        expect(persist).toHaveBeenCalledTimes(1);

        expect(persist).toHaveBeenCalledWith({
          clerkUserId: "user-77",
          clerkOrganizationId: "org-13",
          authorizedRole: "OWNER",
        });

        expect(result).toMatchObject({
          ok: true,
          role: "OWNER",
        });
      },
    );

    it(
      "passes an existing VIEWER decision unchanged without elevation",
      async () => {
        const verify = vi.fn(async () => ({
          allowed: true as const,
          role: "VIEWER" as const,
        }));

        const persist = vi.fn(
          async () =>
            successfulPersistence("VIEWER"),
        );

        const result =
          await provisionCurrentOrganization(
            baseInput,
            {
              verify,
              persist,
            },
          );

        expect(persist).toHaveBeenCalledWith({
          clerkUserId: "user-77",
          clerkOrganizationId: "org-13",
          authorizedRole: "VIEWER",
        });

        expect(result).toMatchObject({
          ok: true,
          role: "VIEWER",
        });
      },
    );

    it(
      "uses only the authenticated user and verified target organization for persistence",
      async () => {
        const verify = vi.fn(async () => ({
          allowed: true as const,
          role: "ANALYST" as const,
        }));

        const persist = vi.fn(
          async () =>
            successfulPersistence("ANALYST"),
        );

        await provisionCurrentOrganization(
          {
            authenticatedUserId: "user-exact",
            selectedOrganizationId: "org-exact",
            targetOrganizationId: "org-exact",
          },
          {
            verify,
            persist,
          },
        );

        expect(verify).toHaveBeenCalledWith({
          authenticatedUserId: "user-exact",
          selectedOrganizationId: "org-exact",
          targetOrganizationId: "org-exact",
        });

        expect(persist).toHaveBeenCalledWith({
          clerkUserId: "user-exact",
          clerkOrganizationId: "org-exact",
          authorizedRole: "ANALYST",
        });
      },
    );

    it(
      "fails closed if an allowed decision violates the authentication invariant",
      async () => {
        const verify = vi.fn(async () => ({
          allowed: true as const,
          role: "OWNER" as const,
        }));

        const persist = vi.fn();

        const result =
          await provisionCurrentOrganization(
            {
              authenticatedUserId: null,
              selectedOrganizationId: "org-13",
              targetOrganizationId: "org-13",
            },
            {
              verify,
              persist,
            },
          );

        expect(result).toEqual({
          ok: false,
          reason:
            "VERIFICATION_INVARIANT_VIOLATION",
        });

        expect(persist).not.toHaveBeenCalled();
      },
    );

    it(
      "fails closed if an allowed decision violates selected-target equality",
      async () => {
        const verify = vi.fn(async () => ({
          allowed: true as const,
          role: "OWNER" as const,
        }));

        const persist = vi.fn();

        const result =
          await provisionCurrentOrganization(
            {
              authenticatedUserId: "user-77",
              selectedOrganizationId: "org-other",
              targetOrganizationId: "org-13",
            },
            {
              verify,
              persist,
            },
          );

        expect(result).toEqual({
          ok: false,
          reason:
            "VERIFICATION_INVARIANT_VIOLATION",
        });

        expect(persist).not.toHaveBeenCalled();
      },
    );

    it(
      "fails closed if an allowed decision has no selected organization",
      async () => {
        const verify = vi.fn(async () => ({
          allowed: true as const,
          role: "OWNER" as const,
        }));

        const persist = vi.fn();

        const result =
          await provisionCurrentOrganization(
            {
              authenticatedUserId: "user-77",
              selectedOrganizationId: null,
              targetOrganizationId: "org-13",
            },
            {
              verify,
              persist,
            },
          );

        expect(result).toEqual({
          ok: false,
          reason:
            "VERIFICATION_INVARIANT_VIOLATION",
        });

        expect(persist).not.toHaveBeenCalled();
      },
    );

    it(
      "returns a persistence failure without converting it into authorization success",
      async () => {
        const verify = vi.fn(async () => ({
          allowed: true as const,
          role: "OWNER" as const,
        }));

        const persist = vi.fn(async () => ({
          ok: false as const,
          reason:
            "ORGANIZATION_NOT_PROVISIONED" as const,
        }));

        const result =
          await provisionCurrentOrganization(
            baseInput,
            {
              verify,
              persist,
            },
          );

        expect(result).toEqual({
          ok: false,
          reason:
            "ORGANIZATION_NOT_PROVISIONED",
        });
      },
    );
  },
);