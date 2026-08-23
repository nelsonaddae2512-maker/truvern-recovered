import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJsonRequest,
  createRouteContext,
  readJsonResponse,
} from "@/tests/support/http";

const mocks = vi.hoisted(() => ({
  getCurrentTruvernAccess: vi.fn(),
  findOrganization: vi.fn(),
  createTruvernCreditLedgerEntry: vi.fn(),
  createOrgNotification: vi.fn(),
  createOrganizationPlanOverride: vi.fn(),
  updateOrganizationPlanOverrides: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/truvern-ops-access", () => ({
  getCurrentTruvernAccess: mocks.getCurrentTruvernAccess,
}));

vi.mock("@/lib/repositories/organization-repository", () => ({
  findOrganization: mocks.findOrganization,
}));

vi.mock("@/lib/repositories/review-credit-ledger-repository", () => ({
  createTruvernCreditLedgerEntry:
    mocks.createTruvernCreditLedgerEntry,
}));

vi.mock("@/lib/notifications/create-notification", () => ({
  createOrgNotification: mocks.createOrgNotification,
}));

vi.mock(
  "@/lib/repositories/organization-plan-override-repository",
  () => ({
    createOrganizationPlanOverride:
      mocks.createOrganizationPlanOverride,
    updateOrganizationPlanOverrides:
      mocks.updateOrganizationPlanOverrides,
  }),
);

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mocks.transaction,
  },
}));

import {
  POST as grantCredits,
} from "@/app/api/truvern/ops/orgs/[orgId]/credit-grant/route";

import {
  DELETE as revokePlanOverride,
  POST as applyPlanOverride,
} from "@/app/api/truvern/ops/orgs/[orgId]/plan-override/route";

type ErrorBody = {
  ok: false;
  error: string;
};

function context(orgId = "7") {
  return createRouteContext({ orgId });
}

function access(
  overrides: Record<string, unknown> = {},
) {
  return {
    userId: "user_ops_1",
    email: "ops@example.test",
    isTruvernOperator: true,
    isTruvernReviewer: true,
    canManageTruvernReview: true,
    ...overrides,
  };
}

describe("Truvern Ops authorization guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getCurrentTruvernAccess.mockResolvedValue(
      access(),
    );

    mocks.findOrganization.mockResolvedValue({
      id: 7,
      name: "Acme Organization",
    });

    mocks.createTruvernCreditLedgerEntry.mockResolvedValue(
      {},
    );

    mocks.createOrgNotification.mockResolvedValue(undefined);

    mocks.createOrganizationPlanOverride.mockResolvedValue(
      {},
    );

    mocks.updateOrganizationPlanOverrides.mockResolvedValue({
      count: 1,
    });

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: Record<string, unknown>) => Promise<unknown>,
      ) => callback({}),
    );
  });

  it("blocks credit grants for non-operators before mutation", async () => {
    mocks.getCurrentTruvernAccess.mockResolvedValue(
      access({
        userId: "user_customer_1",
        isTruvernOperator: false,
        isTruvernReviewer: false,
        canManageTruvernReview: false,
      }),
    );

    const request = createJsonRequest(
      "http://localhost/api/truvern/ops/orgs/7/credit-grant",
      {
        body: {
          amount: 5,
          reason: "Test grant",
        },
      },
    );

    const response = await grantCredits(
      request,
      context(),
    );

    const body =
      await readJsonResponse<ErrorBody>(response);

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: "Unauthorized ops user.",
    });

    expect(
      mocks.findOrganization,
    ).not.toHaveBeenCalled();

    expect(
      mocks.createTruvernCreditLedgerEntry,
    ).not.toHaveBeenCalled();

    expect(
      mocks.createOrgNotification,
    ).not.toHaveBeenCalled();
  });

  it("blocks plan override POST for non-operators before mutation", async () => {
    mocks.getCurrentTruvernAccess.mockResolvedValue(
      access({
        userId: "user_customer_1",
        isTruvernOperator: false,
        isTruvernReviewer: false,
        canManageTruvernReview: false,
      }),
    );

    const request = createJsonRequest(
      "http://localhost/api/truvern/ops/orgs/7/plan-override",
      {
        body: {
          planTier: "ENTERPRISE",
          reason: "Test override",
        },
      },
    );

    const response = await applyPlanOverride(
      request,
      context(),
    );

    const body =
      await readJsonResponse<ErrorBody>(response);

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: "Unauthorized ops user.",
    });

    expect(
      mocks.findOrganization,
    ).not.toHaveBeenCalled();

    expect(
      mocks.transaction,
    ).not.toHaveBeenCalled();

    expect(
      mocks.createOrganizationPlanOverride,
    ).not.toHaveBeenCalled();

    expect(
      mocks.updateOrganizationPlanOverrides,
    ).not.toHaveBeenCalled();

    expect(
      mocks.createOrgNotification,
    ).not.toHaveBeenCalled();
  });

  it("requires centralized actor identity for plan override POST", async () => {
    mocks.getCurrentTruvernAccess.mockResolvedValue(
      access({
        userId: null,
        isTruvernOperator: true,
      }),
    );

    const request = createJsonRequest(
      "http://localhost/api/truvern/ops/orgs/7/plan-override",
      {
        body: {
          planTier: "ENTERPRISE",
          reason: "Test override",
        },
      },
    );

    const response = await applyPlanOverride(
      request,
      context(),
    );

    expect(response.status).toBe(403);

    expect(
      mocks.findOrganization,
    ).not.toHaveBeenCalled();

    expect(
      mocks.transaction,
    ).not.toHaveBeenCalled();
  });

  it("blocks plan override DELETE for non-operators before mutation", async () => {
    mocks.getCurrentTruvernAccess.mockResolvedValue(
      access({
        userId: "user_customer_1",
        isTruvernOperator: false,
        isTruvernReviewer: false,
        canManageTruvernReview: false,
      }),
    );

    const request = new Request(
      "http://localhost/api/truvern/ops/orgs/7/plan-override",
      {
        method: "DELETE",
      },
    );

    const response = await revokePlanOverride(
      request,
      context(),
    );

    const body =
      await readJsonResponse<ErrorBody>(response);

    expect(response.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: "Unauthorized ops user.",
    });

    expect(
      mocks.updateOrganizationPlanOverrides,
    ).not.toHaveBeenCalled();
  });
});
