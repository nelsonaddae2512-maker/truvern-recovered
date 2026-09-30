import { describe, expect, it, vi } from "vitest";

import {
  persistVerifiedOrganizationProvisioning,
} from "@/lib/auth/organization-provisioning-persistence";

function createTransaction(input?: {
  user?: {
    id: number;
    organizationId: number | null;
  } | null;
  organization?: {
    id: number;
  } | null;
  membership?: {
    role:
      | "OWNER"
      | "ADMIN"
      | "ANALYST"
      | "VIEWER"
      | "VENDOR";
  } | null;
}) {
  const user =
    input && "user" in input
      ? input.user
      : {
          id: 77,
          organizationId: null,
        };

  const organization =
    input && "organization" in input
      ? input.organization
      : {
          id: 13,
        };

  const membership =
    input && "membership" in input
      ? input.membership
      : null;

  return {
    user: {
      findUnique: vi.fn(async () => user),
      update: vi.fn(async () => ({
        id: user?.id ?? 0,
      })),
    },
    organization: {
      findUnique: vi.fn(
        async () => organization,
      ),
    },
    orgMembership: {
      findUnique: vi.fn(
        async () => membership,
      ),
      create: vi.fn(async (args) => ({
        role: args.data.role,
      })),
    },
  };
}

function createDependencies(
  tx: ReturnType<typeof createTransaction>,
) {
  return {
    runTransaction: vi.fn(
      async (
        callback: (
          transaction: typeof tx,
        ) => Promise<unknown>,
      ) => callback(tx),
    ),
  };
}

describe(
  "organization provisioning persistence",
  () => {
    it(
      "creates only the authorized missing membership and sets the primary organization",
      async () => {
        const tx = createTransaction();
        const dependencies =
          createDependencies(tx);

        const result =
          await persistVerifiedOrganizationProvisioning(
            {
              clerkUserId: "user-77",
              clerkOrganizationId: "org-13",
              authorizedRole: "OWNER",
            },
            dependencies as never,
          );

        expect(result).toEqual({
          ok: true,
          userId: 77,
          organizationId: 13,
          role: "OWNER",
          membershipCreated: true,
          primaryOrganizationUpdated: true,
        });

        expect(
          tx.orgMembership.create,
        ).toHaveBeenCalledWith({
          data: {
            userId: 77,
            organizationId: 13,
            role: "OWNER",
          },
          select: {
            role: true,
          },
        });

        expect(tx.user.update).toHaveBeenCalledWith({
          where: {
            id: 77,
          },
          data: {
            organizationId: 13,
          },
          select: {
            id: true,
          },
        });
      },
    );

    it(
      "preserves an existing VIEWER role without elevation",
      async () => {
        const tx = createTransaction({
          membership: {
            role: "VIEWER",
          },
        });

        const result =
          await persistVerifiedOrganizationProvisioning(
            {
              clerkUserId: "user-77",
              clerkOrganizationId: "org-13",
              authorizedRole: "OWNER",
            },
            createDependencies(tx) as never,
          );

        expect(result).toMatchObject({
          ok: true,
          role: "VIEWER",
          membershipCreated: false,
        });

        expect(
          tx.orgMembership.create,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "does not rewrite the primary organization when it already matches",
      async () => {
        const tx = createTransaction({
          user: {
            id: 77,
            organizationId: 13,
          },
        });

        const result =
          await persistVerifiedOrganizationProvisioning(
            {
              clerkUserId: "user-77",
              clerkOrganizationId: "org-13",
              authorizedRole: "OWNER",
            },
            createDependencies(tx) as never,
          );

        expect(result).toMatchObject({
          ok: true,
          primaryOrganizationUpdated: false,
        });

        expect(
          tx.user.update,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "fails closed when the Clerk identity has no provisioned Truvern user",
      async () => {
        const tx = createTransaction({
          user: null,
        });

        const result =
          await persistVerifiedOrganizationProvisioning(
            {
              clerkUserId: "user-77",
              clerkOrganizationId: "org-13",
              authorizedRole: "OWNER",
            },
            createDependencies(tx) as never,
          );

        expect(result).toEqual({
          ok: false,
          reason: "USER_NOT_PROVISIONED",
        });

        expect(
          tx.organization.findUnique,
        ).not.toHaveBeenCalled();

        expect(
          tx.orgMembership.create,
        ).not.toHaveBeenCalled();

        expect(
          tx.user.update,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "fails closed when the Clerk organization has no provisioned Truvern organization",
      async () => {
        const tx = createTransaction({
          organization: null,
        });

        const result =
          await persistVerifiedOrganizationProvisioning(
            {
              clerkUserId: "user-77",
              clerkOrganizationId: "org-13",
              authorizedRole: "OWNER",
            },
            createDependencies(tx) as never,
          );

        expect(result).toEqual({
          ok: false,
          reason:
            "ORGANIZATION_NOT_PROVISIONED",
        });

        expect(
          tx.orgMembership.create,
        ).not.toHaveBeenCalled();

        expect(
          tx.user.update,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "uses only the exact Clerk identity and organization identifiers",
      async () => {
        const tx = createTransaction();

        await persistVerifiedOrganizationProvisioning(
          {
            clerkUserId: "user-77",
            clerkOrganizationId: "org-13",
            authorizedRole: "OWNER",
          },
          createDependencies(tx) as never,
        );

        expect(
          tx.user.findUnique,
        ).toHaveBeenCalledWith({
          where: {
            clerkId: "user-77",
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

        expect(
          tx.organization.findUnique,
        ).toHaveBeenCalledWith({
          where: {
            clerkOrgId: "org-13",
          },
          select: {
            id: true,
          },
        });
      },
    );

    it(
      "fails before transaction access for blank identity input",
      async () => {
        const tx = createTransaction();
        const dependencies =
          createDependencies(tx);

        const result =
          await persistVerifiedOrganizationProvisioning(
            {
              clerkUserId: " ",
              clerkOrganizationId: "org-13",
              authorizedRole: "OWNER",
            },
            dependencies as never,
          );

        expect(result).toEqual({
          ok: false,
          reason: "INVALID_INPUT",
        });

        expect(
          dependencies.runTransaction,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "is idempotent when membership and primary organization already exist",
      async () => {
        const tx = createTransaction({
          user: {
            id: 77,
            organizationId: 13,
          },
          membership: {
            role: "OWNER",
          },
        });

        const result =
          await persistVerifiedOrganizationProvisioning(
            {
              clerkUserId: "user-77",
              clerkOrganizationId: "org-13",
              authorizedRole: "OWNER",
            },
            createDependencies(tx) as never,
          );

        expect(result).toEqual({
          ok: true,
          userId: 77,
          organizationId: 13,
          role: "OWNER",
          membershipCreated: false,
          primaryOrganizationUpdated: false,
        });

        expect(
          tx.orgMembership.create,
        ).not.toHaveBeenCalled();

        expect(
          tx.user.update,
        ).not.toHaveBeenCalled();
      },
    );
  },
);