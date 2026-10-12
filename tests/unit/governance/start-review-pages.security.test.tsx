import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  capability: vi.fn(),
  assessment: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  getGovernanceActor: mocks.actor,
  requireGovernanceCapability: mocks.capability,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    assessment: {
      findFirst: mocks.assessment,
    },
  },
}));

vi.mock(
  "@/components/review-desk/start-internal-review.client",
  () => ({
    default: () => null,
  }),
);

import ReviewDeskStart from
  "@/app/review-desk/start-review/page";

import GovernanceOpsStart from
  "@/app/governance-ops/start-review/page";

const pages = [
  { name: "review desk", page: ReviewDeskStart },
  { name: "governance ops", page: GovernanceOpsStart },
] as const;

const params = {
  searchParams: Promise.resolve({
    assessmentId: "27",
    vendorId: "9",
  }),
};

function customer(
  role: "OWNER" | "ADMIN" | "ANALYST" | "VIEWER",
  organizationId: number | null = 21,
) {
  return {
    userId: "customer-1",
    role,
    organizationId,
    vendorId: null,
  };
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.actor.mockResolvedValue(customer("OWNER"));

  mocks.capability.mockImplementation((actor, capability) => {
    if (
      capability !== "assessment.manage" ||
      !["OPS", "OWNER", "ADMIN", "ANALYST"].includes(
        actor.role,
      )
    ) {
      throw new Error("CAPABILITY_DENIED");
    }
  });

  mocks.assessment.mockResolvedValue({ id: 27 });

  mocks.notFound.mockImplementation(() => {
    throw new Error("NOT_FOUND");
  });

  mocks.redirect.mockImplementation((destination) => {
    throw new Error(`REDIRECT:${destination}`);
  });
});

for (const entry of pages) {
  describe(`${entry.name} Start Review security`, () => {
    it.each(["OWNER", "ADMIN", "ANALYST"] as const)(
      "allows %s for a tenant-owned assessment",
      async (role) => {
        mocks.actor.mockResolvedValue(customer(role));

        await expect(entry.page(params)).resolves.toBeTruthy();

        expect(mocks.capability).toHaveBeenCalledWith(
          expect.objectContaining({ role }),
          "assessment.manage",
        );

        expect(mocks.assessment).toHaveBeenCalledWith({
          where: {
            id: 27,
            vendorId: 9,
            organizationId: 21,
          },
          select: { id: true },
        });
      },
    );

    it("denies an assessment outside the tenant", async () => {
      mocks.assessment.mockResolvedValue(null);

      await expect(entry.page(params)).rejects.toThrow(
        "NOT_FOUND",
      );

      expect(mocks.assessment).toHaveBeenCalledWith({
        where: {
          id: 27,
          vendorId: 9,
          organizationId: 21,
        },
        select: { id: true },
      });
    });

    it.each(["VIEWER", "VENDOR", "TRUVERN_REVIEWER"])(
      "denies %s before assessment lookup",
      async (role) => {
        mocks.actor.mockResolvedValue({
          userId: "restricted-1",
          role,
          organizationId: 21,
          vendorId: null,
        });

        await expect(entry.page(params)).rejects.toThrow(
          "CAPABILITY_DENIED",
        );

        expect(mocks.assessment).not.toHaveBeenCalled();
      },
    );

    it("rejects missing customer organization", async () => {
      mocks.actor.mockResolvedValue(
        customer("ADMIN", null),
      );

      await expect(entry.page(params)).rejects.toThrow(
        "NOT_FOUND",
      );

      expect(mocks.assessment).not.toHaveBeenCalled();
    });

    it("allows independently verified Ops actor", async () => {
      mocks.actor.mockResolvedValue({
        userId: "ops-1",
        role: "OPS",
        organizationId: null,
        vendorId: null,
      });

      await expect(entry.page(params)).resolves.toBeTruthy();

      expect(mocks.assessment).toHaveBeenCalledWith({
        where: {
          id: 27,
          vendorId: 9,
        },
        select: { id: true },
      });
    });

    it("rejects nonexistent assessment", async () => {
      mocks.assessment.mockResolvedValue(null);

      await expect(entry.page(params)).rejects.toThrow(
        "NOT_FOUND",
      );
    });

    it("redirects when review IDs are missing", async () => {
      await expect(
        entry.page({
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow("REDIRECT:/review-desk");

      expect(mocks.assessment).not.toHaveBeenCalled();
    });

    it("does not turn invalid IDs into a valid review", async () => {
      await expect(
        entry.page({
          searchParams: Promise.resolve({
            assessmentId: "invalid",
            vendorId: "9",
          }),
        }),
      ).rejects.toThrow("REDIRECT:/review-desk");

      expect(mocks.assessment).not.toHaveBeenCalled();
    });
  });
}