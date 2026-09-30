import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { OrgRole } from "@prisma/client";

import {
  bootstrapCurrentOrganization,
  type BootstrapOrganizationResolution,
  type BootstrapUserResolution,
} from "@/lib/auth/organization-bootstrap-service";

function successProvisioning(
  role: OrgRole = "OWNER",
) {
  return {
    ok: true as const,
    userId: 17,
    organizationId: 41,
    role,
    membershipCreated: true,
    primaryOrganizationUpdated: true,
  };
}

function dependencies() {
  const verifyIdentity = vi.fn<
    (input: {
      authenticatedUserId: string;
      selectedOrganizationId: string;
      targetOrganizationId: string;
    }) => Promise<
      | {
          allowed: true;
          role: OrgRole;
          organizationName: string;
        }
      | {
          allowed: false;
          reason: string;
        }
    >
  >(async () => ({
    allowed: true,
    role: "OWNER",
    organizationName: "Acme Security",
  }));

  const resolveUser = vi.fn<
    (input: {
      clerkUserId: string;
      email: string;
    }) => Promise<BootstrapUserResolution>
  >(async () => ({
    ok: true,
    userId: 17,
    claimed: false,
  }));

  const resolveOrganization = vi.fn<
    (input: {
      clerkOrganizationId: string;
      organizationName: string;
    }) => Promise<BootstrapOrganizationResolution>
  >(async () => ({
    ok: true,
    organizationId: 41,
    created: false,
  }));

  const provision = vi.fn(
    async () => successProvisioning(),
  );

  return {
    verifyIdentity,
    resolveUser,
    resolveOrganization,
    provision,
  };
}

const validInput = {
  authenticatedUserId: "user_123",
  selectedOrganizationId: "org_123",
  targetOrganizationId: "org_123",
  authenticatedEmail: "owner@example.com",
};

describe(
  "bootstrapCurrentOrganization",
  () => {
    it("fails closed when unauthenticated", async () => {
      const deps = dependencies();

      const result =
        await bootstrapCurrentOrganization(
          {
            ...validInput,
            authenticatedUserId: null,
          },
          deps,
        );

      expect(result).toEqual({
        ok: false,
        reason: "UNAUTHENTICATED",
      });

      expect(
        deps.verifyIdentity,
      ).not.toHaveBeenCalled();

      expect(
        deps.resolveUser,
      ).not.toHaveBeenCalled();

      expect(
        deps.resolveOrganization,
      ).not.toHaveBeenCalled();

      expect(
        deps.provision,
      ).not.toHaveBeenCalled();
    });

    it(
      "fails closed without a selected organization",
      async () => {
        const deps = dependencies();

        const result =
          await bootstrapCurrentOrganization(
            {
              ...validInput,
              selectedOrganizationId: null,
            },
            deps,
          );

        expect(result).toEqual({
          ok: false,
          reason: "NO_SELECTED_ORGANIZATION",
        });

        expect(
          deps.verifyIdentity,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects a target different from the selected organization",
      async () => {
        const deps = dependencies();

        const result =
          await bootstrapCurrentOrganization(
            {
              ...validInput,
              targetOrganizationId: "org_other",
            },
            deps,
          );

        expect(result).toEqual({
          ok: false,
          reason: "ORGANIZATION_CONTEXT_MISMATCH",
        });

        expect(
          deps.verifyIdentity,
        ).not.toHaveBeenCalled();

        expect(
          deps.resolveOrganization,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "requires the authenticated email before identity claiming",
      async () => {
        const deps = dependencies();

        const result =
          await bootstrapCurrentOrganization(
            {
              ...validInput,
              authenticatedEmail: null,
            },
            deps,
          );

        expect(result).toEqual({
          ok: false,
          reason: "AUTHENTICATED_EMAIL_REQUIRED",
        });

        expect(
          deps.verifyIdentity,
        ).not.toHaveBeenCalled();

        expect(
          deps.resolveUser,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "stops when Clerk membership verification denies bootstrap",
      async () => {
        const deps = dependencies();

        deps.verifyIdentity.mockResolvedValue({
          allowed: false as const,
          reason: "NOT_ORGANIZATION_MEMBER",
        });

        const result =
          await bootstrapCurrentOrganization(
            validInput,
            deps,
          );

        expect(result).toEqual({
          ok: false,
          reason: "NOT_ORGANIZATION_MEMBER",
        });

        expect(
          deps.resolveUser,
        ).not.toHaveBeenCalled();

        expect(
          deps.resolveOrganization,
        ).not.toHaveBeenCalled();

        expect(
          deps.provision,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "fails when no pre-provisioned Truvern user can be resolved",
      async () => {
        const deps = dependencies();

        deps.resolveUser.mockResolvedValue({
          ok: false as const,
          reason: "USER_NOT_PROVISIONED",
        });

        const result =
          await bootstrapCurrentOrganization(
            validInput,
            deps,
          );

        expect(result).toEqual({
          ok: false,
          reason: "USER_NOT_PROVISIONED",
        });

        expect(
          deps.resolveOrganization,
        ).not.toHaveBeenCalled();

        expect(
          deps.provision,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "fails on a conflicting Truvern user identity",
      async () => {
        const deps = dependencies();

        deps.resolveUser.mockResolvedValue({
          ok: false as const,
          reason: "USER_IDENTITY_CONFLICT",
        });

        const result =
          await bootstrapCurrentOrganization(
            validInput,
            deps,
          );

        expect(result).toEqual({
          ok: false,
          reason: "USER_IDENTITY_CONFLICT",
        });

        expect(
          deps.resolveOrganization,
        ).not.toHaveBeenCalled();

        expect(
          deps.provision,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "fails closed when organization bootstrap fails",
      async () => {
        const deps = dependencies();

        deps.resolveOrganization.mockResolvedValue({
          ok: false as const,
          reason: "ORGANIZATION_BOOTSTRAP_FAILED",
        });

        const result =
          await bootstrapCurrentOrganization(
            validInput,
            deps,
          );

        expect(result).toEqual({
          ok: false,
          reason: "ORGANIZATION_BOOTSTRAP_FAILED",
        });

        expect(
          deps.provision,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "preserves an existing organization binding",
      async () => {
        const deps = dependencies();

        const result =
          await bootstrapCurrentOrganization(
            validInput,
            deps,
          );

        expect(result).toEqual({
          ok: true,
          userId: 17,
          organizationId: 41,
          role: "OWNER",
          userClaimed: false,
          organizationCreated: false,
          membershipCreated: true,
          primaryOrganizationUpdated: true,
        });

        expect(
          deps.resolveOrganization,
        ).toHaveBeenCalledWith({
          clerkOrganizationId: "org_123",
          organizationName: "Acme Security",
        });
      },
    );

    it(
      "reports a first organization binding without changing authorization",
      async () => {
        const deps = dependencies();

        deps.resolveUser.mockResolvedValue({
          ok: true as const,
          userId: 17,
          claimed: true,
        });

        deps.resolveOrganization.mockResolvedValue({
          ok: true as const,
          organizationId: 41,
          created: true,
        });

        const result =
          await bootstrapCurrentOrganization(
            validInput,
            deps,
          );

        expect(result).toMatchObject({
          ok: true,
          userClaimed: true,
          organizationCreated: true,
          role: "OWNER",
        });

        expect(
          deps.provision,
        ).toHaveBeenCalledWith({
          authenticatedUserId: "user_123",
          selectedOrganizationId: "org_123",
          targetOrganizationId: "org_123",
        });
      },
    );

    it(
      "propagates the certified provisioning role",
      async () => {
        const deps = dependencies();

        deps.verifyIdentity.mockResolvedValue({
          allowed: true as const,
          role: "VIEWER" as const,
          organizationName: "Acme Security",
        });

        deps.provision.mockResolvedValue(
          successProvisioning("VIEWER"),
        );

        const result =
          await bootstrapCurrentOrganization(
            validInput,
            deps,
          );

        expect(result).toMatchObject({
          ok: true,
          role: "VIEWER",
        });
      },
    );

    it(
      "fails closed when provisioned user identity differs",
      async () => {
        const deps = dependencies();

        deps.provision.mockResolvedValue({
          ...successProvisioning(),
          userId: 999,
        });

        const result =
          await bootstrapCurrentOrganization(
            validInput,
            deps,
          );

        expect(result).toEqual({
          ok: false,
          reason:
            "BOOTSTRAP_IDENTITY_INVARIANT_VIOLATION",
        });
      },
    );

    it(
      "fails closed when provisioned organization identity differs",
      async () => {
        const deps = dependencies();

        deps.provision.mockResolvedValue({
          ...successProvisioning(),
          organizationId: 999,
        });

        const result =
          await bootstrapCurrentOrganization(
            validInput,
            deps,
          );

        expect(result).toEqual({
          ok: false,
          reason:
            "BOOTSTRAP_IDENTITY_INVARIANT_VIOLATION",
        });
      },
    );

    it(
      "normalizes authenticated email before user resolution",
      async () => {
        const deps = dependencies();

        await bootstrapCurrentOrganization(
          {
            ...validInput,
            authenticatedEmail:
              "  OWNER@EXAMPLE.COM  ",
          },
          deps,
        );

        expect(
          deps.resolveUser,
        ).toHaveBeenCalledWith({
          clerkUserId: "user_123",
          email: "owner@example.com",
        });
      },
    );
  },
);