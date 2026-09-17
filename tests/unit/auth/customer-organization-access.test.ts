import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  readGovernanceDbUserId: vi.fn(),
  claimGovernanceDbUserByEmail: vi.fn(),
  organizationFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  membershipFindFirst: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}));

vi.mock("@/lib/repositories/governance-auth-repository", () => ({
  readGovernanceDbUserId:
    mocks.readGovernanceDbUserId,
  claimGovernanceDbUserByEmail:
    mocks.claimGovernanceDbUserByEmail,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    organization: {
      findFirst:
        mocks.organizationFindFirst,
    },
    user: {
      findUnique:
        mocks.userFindUnique,
    },
    orgMembership: {
      findFirst:
        mocks.membershipFindFirst,
    },
  },
}));

import {
  getCustomerOrganizationActor,
} from "@/lib/auth/customer-organization-access";

describe(
  "customer organization actor resolution",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mocks.auth.mockResolvedValue({
        userId: "user_1",
        orgId: null,
      });

      mocks.readGovernanceDbUserId.mockResolvedValue([
        {
          id: 41,
        },
      ]);

      mocks.organizationFindFirst.mockResolvedValue(
        null,
      );

      mocks.userFindUnique.mockResolvedValue({
        organizationId: null,
      });

      mocks.membershipFindFirst.mockResolvedValue(
        null,
      );
    });

    it(
      "prefers the selected Clerk organization when membership is valid",
      async () => {
        mocks.auth.mockResolvedValue({
          userId: "user_1",
          orgId: "org_selected",
        });

        mocks.organizationFindFirst.mockResolvedValue({
          id: 200,
        });

        mocks.membershipFindFirst.mockResolvedValueOnce({
          organizationId: 200,
          role: "ADMIN",
        });

        const actor =
          await getCustomerOrganizationActor();

        expect(actor).toEqual({
          userId: "user_1",
          dbUserId: 41,
          organizationId: 200,
          role: "ADMIN",
        });

        expect(
          mocks.membershipFindFirst,
        ).toHaveBeenCalledTimes(1);

        expect(
          mocks.membershipFindFirst,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId: 41,
              organizationId: 200,
            }),
          }),
        );
      },
    );

    it(
      "does not grant an unowned selected Clerk organization",
      async () => {
        mocks.auth.mockResolvedValue({
          userId: "user_1",
          orgId: "org_unowned",
        });

        mocks.organizationFindFirst.mockResolvedValue({
          id: 300,
        });

        mocks.userFindUnique.mockResolvedValue({
          organizationId: 400,
        });

        mocks.membershipFindFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            organizationId: 400,
            role: "OWNER",
          });

        const actor =
          await getCustomerOrganizationActor();

        expect(actor?.organizationId).toBe(400);
        expect(actor?.role).toBe("OWNER");

        expect(
          mocks.membershipFindFirst.mock.calls[0][0]
            .where.organizationId,
        ).toBe(300);

        expect(
          mocks.membershipFindFirst.mock.calls[1][0]
            .where.organizationId,
        ).toBe(400);
      },
    );

    it(
      "uses the verified primary organization when no Clerk organization is selected",
      async () => {
        mocks.userFindUnique.mockResolvedValue({
          organizationId: 500,
        });

        mocks.membershipFindFirst.mockResolvedValueOnce({
          organizationId: 500,
          role: "ANALYST",
        });

        const actor =
          await getCustomerOrganizationActor();

        expect(actor).toEqual({
          userId: "user_1",
          dbUserId: 41,
          organizationId: 500,
          role: "ANALYST",
        });

        expect(
          mocks.organizationFindFirst,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "falls back deterministically to the first eligible membership",
      async () => {
        mocks.userFindUnique.mockResolvedValue({
          organizationId: 600,
        });

        mocks.membershipFindFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            organizationId: 700,
            role: "VIEWER",
          });

        const actor =
          await getCustomerOrganizationActor();

        expect(actor?.organizationId).toBe(700);
        expect(actor?.role).toBe("VIEWER");

        expect(
          mocks.membershipFindFirst.mock.calls[1][0]
            .orderBy,
        ).toEqual([
          {
            id: "asc",
          },
        ]);
      },
    );

    it(
      "returns null when no eligible customer membership exists",
      async () => {
        mocks.userFindUnique.mockResolvedValue({
          organizationId: null,
        });

        mocks.membershipFindFirst.mockResolvedValue(
          null,
        );

        const actor =
          await getCustomerOrganizationActor();

        expect(actor).toBeNull();
      },
    );

    it(
      "never creates memberships or organizations while resolving access",
      async () => {
        await getCustomerOrganizationActor();

        expect(
          mocks.organizationFindFirst,
        ).not.toHaveBeenCalled();

        expect(
          mocks.membershipFindFirst,
        ).toHaveBeenCalledTimes(1);
      },
    );
  },
);