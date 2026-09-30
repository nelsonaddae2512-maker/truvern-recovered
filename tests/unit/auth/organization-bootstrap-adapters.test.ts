import { Prisma } from "@prisma/client";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  buildBootstrapOrganizationSlug,
  resolveBootstrapOrganization,
  resolveBootstrapUser,
} from "@/lib/auth/organization-bootstrap-adapters";

function p2002() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed",
    {
      code: "P2002",
      clientVersion: "6.19.2",
      meta: {},
    },
  );
}

describe("organization bootstrap adapters", () => {
  describe("buildBootstrapOrganizationSlug", () => {
    it("is deterministic and includes the Clerk organization identity", () => {
      expect(
        buildBootstrapOrganizationSlug({
          organizationName: "Acme Security, Inc.",
          clerkOrganizationId: "org_ABC123",
        }),
      ).toBe(
        "acme-security-inc-org-abc123",
      );
    });

    it("does not use a random or time-based suffix", () => {
      const first =
        buildBootstrapOrganizationSlug({
          organizationName: "Acme Security",
          clerkOrganizationId: "org_ABC123",
        });

      const second =
        buildBootstrapOrganizationSlug({
          organizationName: "Acme Security",
          clerkOrganizationId: "org_ABC123",
        });

      expect(first).toBe(second);
    });
  });

  describe("resolveBootstrapUser", () => {
    it("returns an existing exact Clerk binding without claiming", async () => {
      const readUser = vi
        .fn()
        .mockResolvedValue([
          {
            id: 17,
          },
        ]);

      const claimUser = vi.fn();

      const result =
        await resolveBootstrapUser(
          {
            clerkUserId: "user_123",
            email: "OWNER@EXAMPLE.COM",
          },
          {
            readUser,
            claimUser,
          },
        );

      expect(result).toEqual({
        ok: true,
        userId: 17,
        claimed: false,
      });

      expect(claimUser).not.toHaveBeenCalled();
    });

    it("claims only through the existing governance claim primitive", async () => {
      const readUser = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 17,
          },
        ]);

      const claimUser = vi
        .fn()
        .mockResolvedValue({
          id: 17,
        });

      const result =
        await resolveBootstrapUser(
          {
            clerkUserId: " user_123 ",
            email: " OWNER@EXAMPLE.COM ",
          },
          {
            readUser,
            claimUser,
          },
        );

      expect(claimUser).toHaveBeenCalledWith({
        clerkUserId: "user_123",
        email: "owner@example.com",
      });

      expect(result).toEqual({
        ok: true,
        userId: 17,
        claimed: true,
      });
    });

    it("fails when no pre-provisioned user can be claimed", async () => {
      const result =
        await resolveBootstrapUser(
          {
            clerkUserId: "user_123",
            email: "owner@example.com",
          },
          {
            readUser: vi
              .fn()
              .mockResolvedValue([]),
            claimUser: vi
              .fn()
              .mockResolvedValue(null),
          },
        );

      expect(result).toEqual({
        ok: false,
        reason: "USER_NOT_PROVISIONED",
      });
    });

    it("fails closed when the post-claim Clerk identity cannot be confirmed", async () => {
      const readUser = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 99,
          },
        ]);

      const result =
        await resolveBootstrapUser(
          {
            clerkUserId: "user_123",
            email: "owner@example.com",
          },
          {
            readUser,
            claimUser: vi
              .fn()
              .mockResolvedValue({
                id: 17,
              }),
          },
        );

      expect(result).toEqual({
        ok: false,
        reason: "USER_IDENTITY_CONFLICT",
      });
    });

    it("fails closed on ambiguous exact-user resolution", async () => {
      const result =
        await resolveBootstrapUser(
          {
            clerkUserId: "user_123",
            email: "owner@example.com",
          },
          {
            readUser: vi
              .fn()
              .mockResolvedValue([
                { id: 17 },
                { id: 18 },
              ]),
            claimUser: vi.fn(),
          },
        );

      expect(result).toEqual({
        ok: false,
        reason: "USER_IDENTITY_CONFLICT",
      });
    });
  });

  describe("resolveBootstrapOrganization", () => {
    it("preserves an existing exact Clerk organization binding", async () => {
      const organization = {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            id: 41,
            clerkOrgId: "org_123",
          }),
        create: vi.fn(),
      };

      const result =
        await resolveBootstrapOrganization(
          {
            clerkOrganizationId: "org_123",
            organizationName: "Acme Security",
          },
          {
            organization,
          } as never,
        );

      expect(result).toEqual({
        ok: true,
        organizationId: 41,
        created: false,
      });

      expect(
        organization.create,
      ).not.toHaveBeenCalled();
    });

    it("creates the first exact Clerk organization binding", async () => {
      const organization = {
        findUnique: vi
          .fn()
          .mockResolvedValue(null),
        create: vi
          .fn()
          .mockResolvedValue({
            id: 41,
            clerkOrgId: "org_123",
          }),
      };

      const result =
        await resolveBootstrapOrganization(
          {
            clerkOrganizationId: "org_123",
            organizationName: "Acme Security",
          },
          {
            organization,
          } as never,
        );

      expect(
        organization.create,
      ).toHaveBeenCalledWith({
        data: {
          clerkOrgId: "org_123",
          name: "Acme Security",
          slug: "acme-security-org-123",
        },
        select: {
          id: true,
          clerkOrgId: true,
        },
      });

      expect(result).toEqual({
        ok: true,
        organizationId: 41,
        created: true,
      });
    });

    it("accepts an exact concurrent winner after P2002", async () => {
      const organization = {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 41,
            clerkOrgId: "org_123",
          }),
        create: vi
          .fn()
          .mockRejectedValue(
            p2002(),
          ),
      };

      const result =
        await resolveBootstrapOrganization(
          {
            clerkOrganizationId: "org_123",
            organizationName: "Acme Security",
          },
          {
            organization,
          } as never,
        );

      expect(result).toEqual({
        ok: true,
        organizationId: 41,
        created: false,
      });
    });

    it("rejects a P2002 collision without the exact Clerk binding", async () => {
      const organization = {
        findUnique: vi
          .fn()
          .mockResolvedValue(null),
        create: vi
          .fn()
          .mockRejectedValue(
            p2002(),
          ),
      };

      const result =
        await resolveBootstrapOrganization(
          {
            clerkOrganizationId: "org_123",
            organizationName: "Acme Security",
          },
          {
            organization,
          } as never,
        );

      expect(result).toEqual({
        ok: false,
        reason: "ORGANIZATION_IDENTITY_CONFLICT",
      });
    });

    it("rethrows non-P2002 persistence failures", async () => {
      const failure =
        new Error("database unavailable");

      const organization = {
        findUnique: vi
          .fn()
          .mockResolvedValue(null),
        create: vi
          .fn()
          .mockRejectedValue(failure),
      };

      await expect(
        resolveBootstrapOrganization(
          {
            clerkOrganizationId: "org_123",
            organizationName: "Acme Security",
          },
          {
            organization,
          } as never,
        ),
      ).rejects.toBe(failure);
    });

    it("rejects blank organization identity input without persistence", async () => {
      const organization = {
        findUnique: vi.fn(),
        create: vi.fn(),
      };

      const result =
        await resolveBootstrapOrganization(
          {
            clerkOrganizationId: " ",
            organizationName: "Acme Security",
          },
          {
            organization,
          } as never,
        );

      expect(result).toEqual({
        ok: false,
        reason: "ORGANIZATION_BOOTSTRAP_FAILED",
      });

      expect(
        organization.findUnique,
      ).not.toHaveBeenCalled();

      expect(
        organization.create,
      ).not.toHaveBeenCalled();
    });
  });
});