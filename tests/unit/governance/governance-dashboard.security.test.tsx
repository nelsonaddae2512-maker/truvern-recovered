import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  plan: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
  queueSummary: vi.fn(),
  taskSummary: vi.fn(),
  recentReviews: vi.fn(),
  workload: vi.fn(),
  workflowQueue: vi.fn(),
  aiQueue: vi.fn(),
  releaseReady: vi.fn(),
  events: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  getGovernanceActor: mocks.actor,
}));

vi.mock("@/lib/billing/organization-plan", () => ({
  resolveOrganizationPlanTier: mocks.plan,
}));

vi.mock("@/lib/billing/plan-access", () => ({
  canAccessTier: (current: string, required: string) =>
    required === "PRO" &&
    (current === "PRO" || current === "ENTERPRISE"),
}));

vi.mock("@/lib/repositories/governance-dashboard-repository", () => ({
  readGovernanceQueueSummary: mocks.queueSummary,
  readGovernanceTaskSummary: mocks.taskSummary,
  readRecentGovernanceReviews: mocks.recentReviews,
  readGovernanceWorkload: mocks.workload,
  readGovernanceWorkflowQueue: mocks.workflowQueue,
  readGovernanceAiQueue: mocks.aiQueue,
  readGovernanceReleaseReady: mocks.releaseReady,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: mocks.events,
  },
}));

vi.mock("@/components/governance/governance-dashboard.client", () => ({
  default: () => null,
}));

import GovernancePage from "@/app/governance/page";

const reads = [
  mocks.queueSummary,
  mocks.taskSummary,
  mocks.recentReviews,
  mocks.workload,
  mocks.workflowQueue,
  mocks.aiQueue,
  mocks.releaseReady,
];

function customer(
  role: string = "OWNER",
  organizationId: number | null = 21,
) {
  return {
    userId: "customer-1",
    role,
    organizationId,
    vendorId: null,
  };
}

function expectNoDashboardReads() {
  for (const read of reads) {
    expect(read).not.toHaveBeenCalled();
  }
  expect(mocks.events).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.actor.mockResolvedValue(customer());
  mocks.plan.mockResolvedValue("PRO");

  mocks.notFound.mockImplementation(() => {
    throw new Error("NOT_FOUND");
  });

  mocks.redirect.mockImplementation((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  });

  for (const read of reads) {
    read.mockResolvedValue([]);
  }

  mocks.events.mockResolvedValue([]);
});

describe("Governance dashboard authorization", () => {
  it("shows the Free upgrade screen without dashboard reads", async () => {
    mocks.plan.mockResolvedValue("FREE");

    const result = await GovernancePage();

    expect(result).toBeTruthy();
    expect(mocks.plan).toHaveBeenCalledExactlyOnceWith(21);
    expectNoDashboardReads();
  });

  it.each(["PRO", "ENTERPRISE"] as const)(
    "allows %s and scopes every dashboard read to the actor organization",
    async (tier) => {
      mocks.plan.mockResolvedValue(tier);

      const result = await GovernancePage();

      expect(result).toBeTruthy();
      expect(mocks.plan).toHaveBeenCalledExactlyOnceWith(21);

      for (const read of reads) {
        expect(read).toHaveBeenCalledExactlyOnceWith(21);
      }

      expect(mocks.events).toHaveBeenCalledTimes(1);

      const sqlCall = mocks.events.mock.calls[0];
      expect(sqlCall[1]).toBe(21);
      expect(sqlCall[0].join(" ")).toContain(
        'where "organizationId" = ',
      );
    },
  );

  it("uses a different selected customer organization, not a fixed tenant", async () => {
    mocks.actor.mockResolvedValue(customer("ADMIN", 84));
    mocks.plan.mockResolvedValue("ENTERPRISE");

    await GovernancePage();

    expect(mocks.plan).toHaveBeenCalledExactlyOnceWith(84);

    for (const read of reads) {
      expect(read).toHaveBeenCalledExactlyOnceWith(84);
    }

    expect(mocks.events.mock.calls[0][1]).toBe(84);
  });

  it("redirects genuine Ops before plan or customer data access", async () => {
    mocks.actor.mockResolvedValue({
      userId: "ops-1",
      role: "OPS",
      organizationId: null,
      vendorId: null,
    });

    await expect(GovernancePage()).rejects.toThrow(
      "REDIRECT:/truvern/ops/command-center",
    );

    expect(mocks.plan).not.toHaveBeenCalled();
    expectNoDashboardReads();
  });

  it.each(["VENDOR", "TRUVERN_REVIEWER", "UNKNOWN"])(
    "denies %s before subscription lookup",
    async (role) => {
      mocks.actor.mockResolvedValue(customer(role));

      await expect(GovernancePage()).rejects.toThrow(
        "NOT_FOUND",
      );

      expect(mocks.plan).not.toHaveBeenCalled();
      expectNoDashboardReads();
    },
  );

  it.each([null, 0, -1, 1.5, Number.NaN])(
    "rejects invalid organization ID %s",
    async (organizationId) => {
      mocks.actor.mockResolvedValue(
        customer("OWNER", organizationId),
      );

      await expect(GovernancePage()).rejects.toThrow(
        "NOT_FOUND",
      );

      expect(mocks.plan).not.toHaveBeenCalled();
      expectNoDashboardReads();
    },
  );

  it("propagates authentication failure without querying billing or data", async () => {
    mocks.actor.mockRejectedValue(
      new Error("AUTH_REQUIRED"),
    );

    await expect(GovernancePage()).rejects.toThrow(
      "AUTH_REQUIRED",
    );

    expect(mocks.plan).not.toHaveBeenCalled();
    expectNoDashboardReads();
  });

  it("fails closed when subscription resolution fails", async () => {
    mocks.plan.mockRejectedValue(
      new Error("PLAN_UNAVAILABLE"),
    );

    await expect(GovernancePage()).rejects.toThrow(
      "PLAN_UNAVAILABLE",
    );

    expectNoDashboardReads();
  });

  it("does not grant Ops access to an Enterprise customer", async () => {
    mocks.actor.mockResolvedValue(customer("OWNER", 21));
    mocks.plan.mockResolvedValue("ENTERPRISE");

    await GovernancePage();

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.plan).toHaveBeenCalledWith(21);
    expect(mocks.queueSummary).toHaveBeenCalledWith(21);
  });
});