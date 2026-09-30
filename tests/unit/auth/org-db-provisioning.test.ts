import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  provisionCurrentOrganization: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    organization: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock(
  "@/lib/auth/organization-provisioning-service",
  () => ({
    provisionCurrentOrganization:
      mocks.provisionCurrentOrganization,
  }),
);

import {
  requireDbOrganization,
} from "@/lib/org-db";

describe(
  "requireDbOrganization verified provisioning boundary",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "fails closed when unauthenticated",
      async () => {
        mocks.auth.mockResolvedValue({
          userId: null,
          orgId: null,
        });

        await expect(
          requireDbOrganization(),
        ).resolves.toEqual({
          _needsOrgSelection: true,
        });

        expect(
          mocks.findUnique,
        ).not.toHaveBeenCalled();

        expect(
          mocks.provisionCurrentOrganization,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "fails closed without a selected organization",
      async () => {
        mocks.auth.mockResolvedValue({
          userId: "user_1",
          orgId: null,
        });

        await expect(
          requireDbOrganization(),
        ).resolves.toEqual({
          _needsOrgSelection: true,
        });

        expect(
          mocks.findUnique,
        ).not.toHaveBeenCalled();

        expect(
          mocks.provisionCurrentOrganization,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "does not create an unbound organization",
      async () => {
        mocks.auth.mockResolvedValue({
          userId: "user_1",
          orgId: "org_1",
        });

        mocks.findUnique.mockResolvedValue(
          null,
        );

        await expect(
          requireDbOrganization(),
        ).resolves.toEqual({
          _needsOrgSelection: true,
        });

        expect(
          mocks.provisionCurrentOrganization,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "provisions the exact selected organization",
      async () => {
        const organization = {
          id: 41,
          name: "Example",
          slug: "example",
          clerkOrgId: "org_1",
        };

        mocks.auth.mockResolvedValue({
          userId: "user_1",
          orgId: "org_1",
        });

        mocks.findUnique.mockResolvedValue(
          organization,
        );

        mocks.provisionCurrentOrganization
          .mockResolvedValue({
            ok: true,
            userId: 7,
            organizationId: 41,
            role: "ADMIN",
            membershipCreated: true,
            primaryOrganizationUpdated: true,
          });

        await expect(
          requireDbOrganization(),
        ).resolves.toEqual(
          organization,
        );

        expect(
          mocks.provisionCurrentOrganization,
        ).toHaveBeenCalledTimes(1);

        expect(
          mocks.provisionCurrentOrganization,
        ).toHaveBeenCalledWith({
          authenticatedUserId: "user_1",
          selectedOrganizationId: "org_1",
          targetOrganizationId: "org_1",
        });
      },
    );

    it(
      "fails closed when verification denies provisioning",
      async () => {
        mocks.auth.mockResolvedValue({
          userId: "user_1",
          orgId: "org_1",
        });

        mocks.findUnique.mockResolvedValue({
          id: 41,
          name: "Example",
          slug: "example",
          clerkOrgId: "org_1",
        });

        mocks.provisionCurrentOrganization
          .mockResolvedValue({
            ok: false,
            reason: "MEMBERSHIP_NOT_VERIFIED",
          });

        await expect(
          requireDbOrganization(),
        ).resolves.toEqual({
          _needsOrgSelection: true,
        });
      },
    );

    it(
      "fails closed on organization identity mismatch",
      async () => {
        mocks.auth.mockResolvedValue({
          userId: "user_1",
          orgId: "org_1",
        });

        mocks.findUnique.mockResolvedValue({
          id: 41,
          name: "Example",
          slug: "example",
          clerkOrgId: "org_1",
        });

        mocks.provisionCurrentOrganization
          .mockResolvedValue({
            ok: true,
            userId: 7,
            organizationId: 99,
            role: "ADMIN",
            membershipCreated: false,
            primaryOrganizationUpdated: false,
          });

        await expect(
          requireDbOrganization(),
        ).resolves.toEqual({
          _needsOrgSelection: true,
        });
      },
    );
  },
);
