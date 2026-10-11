import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  }),
  access: vi.fn(),
  organization: vi.fn(),
  membership: vi.fn(),
  readUsers: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/truvern-ops-access", () => ({
  getCurrentTruvernAccess: mocks.access,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    organization: {
      findUnique: mocks.organization,
    },
    orgMembership: {
      findFirst: mocks.membership,
    },
  },
}));

vi.mock("@/lib/repositories/governance-auth-repository", () => ({
  readGovernanceDbUserId: mocks.readUsers,
}));

import {
  requireDashboardOrganizationAccess,
} from "@/lib/auth/dashboard-organization-guard";

describe("dashboard organization authorization behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    delete process.env.TRUVERN_OPS_USERS;

    mocks.auth.mockResolvedValue({
      userId: "user_customer",
      orgId: "org_selected",
    });

    mocks.access.mockResolvedValue({
      isTruvernOperator: false,
    });

    mocks.organization.mockResolvedValue({
      id: 20,
    });

    mocks.readUsers.mockResolvedValue([
      { id: 101 },
    ]);

    mocks.membership.mockResolvedValue({
      id: 500,
    });
  });

  it("redirects unauthenticated visitors", async () => {
    mocks.auth.mockResolvedValue({
      userId: null,
      orgId: null,
    });

    await expect(
      requireDashboardOrganizationAccess(),
    ).rejects.toThrow(
      "REDIRECT:/sign-in?redirect_url=%2Fdashboard",
    );

    expect(mocks.membership).not.toHaveBeenCalled();
  });

  it("redirects users without selected organizations", async () => {
    mocks.auth.mockResolvedValue({
      userId: "user_customer",
      orgId: null,
    });

    await expect(
      requireDashboardOrganizationAccess(),
    ).rejects.toThrow(
      "REDIRECT:/select-org?returnTo=%2Fdashboard",
    );

    expect(mocks.organization).not.toHaveBeenCalled();
  });

  it("routes unprovisioned organizations to completion", async () => {
    mocks.organization.mockResolvedValue(null);

    await expect(
      requireDashboardOrganizationAccess(),
    ).rejects.toThrow(
      "REDIRECT:/select-org/complete?returnTo=%2Fdashboard",
    );
  });

  it("rejects missing verified membership", async () => {
    mocks.membership.mockResolvedValue(null);

    await expect(
      requireDashboardOrganizationAccess(),
    ).rejects.toThrow(
      "REDIRECT:/select-org/complete?returnTo=%2Fdashboard",
    );

    expect(mocks.membership).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 101,
          organizationId: 20,
        }),
      }),
    );
  });

  it("allows verified organization members", async () => {
    await expect(
      requireDashboardOrganizationAccess(),
    ).resolves.toBeUndefined();

    expect(mocks.membership).toHaveBeenCalled();
  });

  it("allows operators recognized by the access service", async () => {
    mocks.auth.mockResolvedValue({
      userId: "user_operator",
      orgId: null,
    });

    mocks.access.mockResolvedValue({
      isTruvernOperator: true,
    });

    await expect(
      requireDashboardOrganizationAccess(),
    ).resolves.toBeUndefined();

    expect(mocks.membership).not.toHaveBeenCalled();
  });

  it("allows explicitly configured operator IDs", async () => {
    process.env.TRUVERN_OPS_USERS = "user_operator";

    mocks.auth.mockResolvedValue({
      userId: "user_operator",
      orgId: null,
    });

    await expect(
      requireDashboardOrganizationAccess(),
    ).resolves.toBeUndefined();

    expect(mocks.membership).not.toHaveBeenCalled();
  });

  it("does not grant reviewer-only access", async () => {
    mocks.auth.mockResolvedValue({
      userId: "user_reviewer",
      orgId: null,
    });

    mocks.access.mockResolvedValue({
      isTruvernOperator: false,
      isTruvernReviewer: true,
    });

    await expect(
      requireDashboardOrganizationAccess(),
    ).rejects.toThrow(
      "REDIRECT:/select-org?returnTo=%2Fdashboard",
    );
  });
});