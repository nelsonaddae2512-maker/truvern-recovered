import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  bootstrapCurrentOrganizationFromRuntime,
} from "@/lib/auth/organization-bootstrap-runtime";

function successResult() {
  return {
    ok: true as const,
    userId: 7,
    organizationId: 11,
    role: "OWNER" as const,
    userClaimed: false,
    organizationCreated: false,
    membershipCreated: false,
    primaryOrganizationUpdated: false,
  };
}

function createDependencies(
  overrides: Partial<{
    getAuthContext: () => Promise<{
      userId: string | null;
      orgId: string | null;
    }>;
    getCurrentUserIdentity: () => Promise<
      | {
          id: string;
          primaryEmailAddress: {
            emailAddress: string;
          } | null;
        }
      | null
    >;
    runBootstrap: (input: {
      authenticatedUserId: string | null;
      selectedOrganizationId: string | null;
      targetOrganizationId: string;
      authenticatedEmail: string | null;
    }) => Promise<ReturnType<typeof successResult>>;
  }> = {},
) {
  return {
    getAuthContext:
      overrides.getAuthContext ??
      vi.fn(async () => ({
        userId: "user_123",
        orgId: "org_456",
      })),

    getCurrentUserIdentity:
      overrides.getCurrentUserIdentity ??
      vi.fn(async () => ({
        id: "user_123",
        primaryEmailAddress: {
          emailAddress: "Owner@Example.COM ",
        },
      })),

    runBootstrap:
      overrides.runBootstrap ??
      vi.fn(async () => successResult()),
  };
}

describe(
  "runtime organization bootstrap composition",
  () => {
    it("fails closed when no authenticated user exists", async () => {
      const dependencies =
        createDependencies({
          getAuthContext: vi.fn(async () => ({
            userId: null,
            orgId: "org_456",
          })),
        });

      const result =
        await bootstrapCurrentOrganizationFromRuntime(
          dependencies,
        );

      expect(result).toEqual({
        ok: false,
        reason: "UNAUTHENTICATED",
      });

      expect(
        dependencies.getCurrentUserIdentity,
      ).not.toHaveBeenCalled();

      expect(
        dependencies.runBootstrap,
      ).not.toHaveBeenCalled();
    });

    it("fails closed when no Clerk organization is selected", async () => {
      const dependencies =
        createDependencies({
          getAuthContext: vi.fn(async () => ({
            userId: "user_123",
            orgId: null,
          })),
        });

      const result =
        await bootstrapCurrentOrganizationFromRuntime(
          dependencies,
        );

      expect(result).toEqual({
        ok: false,
        reason: "NO_SELECTED_ORGANIZATION",
      });

      expect(
        dependencies.getCurrentUserIdentity,
      ).not.toHaveBeenCalled();

      expect(
        dependencies.runBootstrap,
      ).not.toHaveBeenCalled();
    });

    it("fails closed when currentUser cannot be resolved", async () => {
      const dependencies =
        createDependencies({
          getCurrentUserIdentity:
            vi.fn(async () => null),
        });

      const result =
        await bootstrapCurrentOrganizationFromRuntime(
          dependencies,
        );

      expect(result).toEqual({
        ok: false,
        reason: "AUTHENTICATED_IDENTITY_MISMATCH",
      });

      expect(
        dependencies.runBootstrap,
      ).not.toHaveBeenCalled();
    });

    it("rejects a currentUser identity that differs from auth userId", async () => {
      const dependencies =
        createDependencies({
          getCurrentUserIdentity:
            vi.fn(async () => ({
              id: "user_other",
              primaryEmailAddress: {
                emailAddress:
                  "owner@example.com",
              },
            })),
        });

      const result =
        await bootstrapCurrentOrganizationFromRuntime(
          dependencies,
        );

      expect(result).toEqual({
        ok: false,
        reason: "AUTHENTICATED_IDENTITY_MISMATCH",
      });

      expect(
        dependencies.runBootstrap,
      ).not.toHaveBeenCalled();
    });

    it("fails closed when the authenticated user has no primary email", async () => {
      const dependencies =
        createDependencies({
          getCurrentUserIdentity:
            vi.fn(async () => ({
              id: "user_123",
              primaryEmailAddress: null,
            })),
        });

      const result =
        await bootstrapCurrentOrganizationFromRuntime(
          dependencies,
        );

      expect(result).toEqual({
        ok: false,
        reason: "AUTHENTICATED_EMAIL_REQUIRED",
      });

      expect(
        dependencies.runBootstrap,
      ).not.toHaveBeenCalled();
    });

    it("fails closed when the primary email is blank", async () => {
      const dependencies =
        createDependencies({
          getCurrentUserIdentity:
            vi.fn(async () => ({
              id: "user_123",
              primaryEmailAddress: {
                emailAddress: "   ",
              },
            })),
        });

      const result =
        await bootstrapCurrentOrganizationFromRuntime(
          dependencies,
        );

      expect(result).toEqual({
        ok: false,
        reason: "AUTHENTICATED_EMAIL_REQUIRED",
      });

      expect(
        dependencies.runBootstrap,
      ).not.toHaveBeenCalled();
    });

    it("uses the selected organization as the exact bootstrap target", async () => {
      const dependencies =
        createDependencies();

      await bootstrapCurrentOrganizationFromRuntime(
        dependencies,
      );

      expect(
        dependencies.runBootstrap,
      ).toHaveBeenCalledTimes(1);

      expect(
        dependencies.runBootstrap,
      ).toHaveBeenCalledWith({
        authenticatedUserId: "user_123",
        selectedOrganizationId: "org_456",
        targetOrganizationId: "org_456",
        authenticatedEmail:
          "owner@example.com",
      });
    });

    it("normalizes runtime identity before bootstrap", async () => {
      const dependencies =
        createDependencies({
          getAuthContext: vi.fn(async () => ({
            userId: "  user_123  ",
            orgId: "  org_456  ",
          })),
          getCurrentUserIdentity:
            vi.fn(async () => ({
              id: "user_123",
              primaryEmailAddress: {
                emailAddress:
                  "  OWNER@EXAMPLE.COM  ",
              },
            })),
        });

      await bootstrapCurrentOrganizationFromRuntime(
        dependencies,
      );

      expect(
        dependencies.runBootstrap,
      ).toHaveBeenCalledWith({
        authenticatedUserId: "user_123",
        selectedOrganizationId: "org_456",
        targetOrganizationId: "org_456",
        authenticatedEmail:
          "owner@example.com",
      });
    });

    it("returns the certified bootstrap result unchanged", async () => {
      const expected =
        successResult();

      const dependencies =
        createDependencies({
          runBootstrap:
            vi.fn(async () => expected),
        });

      const result =
        await bootstrapCurrentOrganizationFromRuntime(
          dependencies,
        );

      expect(result).toEqual(expected);
    });
  },
);