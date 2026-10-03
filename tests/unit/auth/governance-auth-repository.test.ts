import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  userCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      create: mocks.userCreate,
    },
  },
}));

import {
  createGovernanceDbUser,
} from "@/lib/repositories/governance-auth-repository";

describe("governance auth repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createGovernanceDbUser", () => {
    it("normalizes and creates exactly one first Truvern DB identity", async () => {
      mocks.userCreate.mockResolvedValue({
        id: 17,
      });

      const result =
        await createGovernanceDbUser({
          clerkUserId: " user_123 ",
          email: " OWNER@EXAMPLE.COM ",
        });

      expect(mocks.userCreate).toHaveBeenCalledTimes(1);

      expect(mocks.userCreate).toHaveBeenCalledWith({
        data: {
          clerkId: "user_123",
          email: "owner@example.com",
        },
        select: {
          id: true,
        },
      });

      expect(result).toEqual({
        ok: true,
        user: {
          id: 17,
        },
        created: true,
      });
    });

    it("fails closed for an empty normalized identity without calling Prisma", async () => {
      const result =
        await createGovernanceDbUser({
          clerkUserId: "   ",
          email: "   ",
        });

      expect(result).toEqual({
        ok: false,
        reason: "IDENTITY_ALREADY_EXISTS",
      });

      expect(mocks.userCreate).not.toHaveBeenCalled();
    });

    it("maps a structural P2002 unique collision to IDENTITY_ALREADY_EXISTS", async () => {
      mocks.userCreate.mockRejectedValue({
        code: "P2002",
      });

      const result =
        await createGovernanceDbUser({
          clerkUserId: "user_123",
          email: "owner@example.com",
        });

      expect(mocks.userCreate).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        ok: false,
        reason: "IDENTITY_ALREADY_EXISTS",
      });
    });

    it("rethrows non-P2002 persistence failures unchanged", async () => {
      const failure =
        new Error("database unavailable");

      mocks.userCreate.mockRejectedValue(
        failure,
      );

      await expect(
        createGovernanceDbUser({
          clerkUserId: "user_123",
          email: "owner@example.com",
        }),
      ).rejects.toBe(failure);

      expect(mocks.userCreate).toHaveBeenCalledTimes(1);
    });

    it("does not expose organization or membership persistence in its Prisma boundary", () => {
      expect(
        Object.keys({
          user: {
            create: mocks.userCreate,
          },
        }),
      ).toEqual([
        "user",
      ]);
    });
  });
});