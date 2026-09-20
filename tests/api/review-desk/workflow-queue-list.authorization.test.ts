import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess: vi.fn(),
  governanceAuthErrorResponse: vi.fn(() => null),
  reviewAssignmentFindMany: vi.fn(),
  groupWorkflowQueueItems: vi.fn(),
  findWorkflowQueueItems: vi.fn(),
  findVendors: vi.fn(),
  findOrganizations: vi.fn(),
  findRemediationPackages: vi.fn(),
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
}));

vi.mock("@/lib/auth/governance-auth-errors", () => ({
  governanceAuthErrorResponse: mocks.governanceAuthErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    reviewAssignment: {
      findMany: mocks.reviewAssignmentFindMany,
    },
  },
}));

vi.mock("@/lib/repositories/workflow-queue-repository", () => ({
  groupWorkflowQueueItems: mocks.groupWorkflowQueueItems,
  findWorkflowQueueItems: mocks.findWorkflowQueueItems,
}));

vi.mock("@/lib/repositories/vendor-repository", () => ({
  findVendors: mocks.findVendors,
}));

vi.mock("@/lib/repositories/organization-repository", () => ({
  findOrganizations: mocks.findOrganizations,
}));

vi.mock("@/lib/repositories/remediation-package-repository", () => ({
  findRemediationPackages: mocks.findRemediationPackages,
}));

import { GET } from "@/app/api/review-desk/workflow-queue/route";

describe("workflow queue list authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.groupWorkflowQueueItems.mockResolvedValue([]);
    mocks.findWorkflowQueueItems.mockResolvedValue([]);
    mocks.findVendors.mockResolvedValue([]);
    mocks.findOrganizations.mockResolvedValue([]);
    mocks.findRemediationPackages.mockResolvedValue([]);
  });

  it("allows OPS to query the full queue scope", async () => {
    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "ops-user",
      role: "OPS",
      organizationId: null,
      vendorId: null,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.groupWorkflowQueueItems).toHaveBeenCalledWith({});
    expect(mocks.findWorkflowQueueItems).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{}, { status: "OPEN" }],
        },
      }),
    );
  });

  it("scopes customer reviewers to their organization", async () => {
    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "customer-user",
      role: "ANALYST",
      organizationId: 44,
      vendorId: null,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.groupWorkflowQueueItems).toHaveBeenCalledWith({
      organizationId: 44,
    });
    expect(mocks.findWorkflowQueueItems).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { organizationId: 44 },
            { status: "OPEN" },
          ],
        },
      }),
    );
  });

  it("scopes Truvern reviewers to their assigned Truvern review IDs", async () => {
    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "truvern-reviewer",
      role: "TRUVERN_REVIEWER",
      organizationId: null,
      vendorId: null,
    });

    mocks.reviewAssignmentFindMany.mockResolvedValue([
      { id: 71 },
      { id: 72 },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.reviewAssignmentFindMany).toHaveBeenCalledWith({
      where: {
        assignmentType: "TRUVERN",
        reviewerUserId: "truvern-reviewer",
      },
      select: {
        id: true,
      },
    });
    expect(mocks.groupWorkflowQueueItems).toHaveBeenCalledWith({
      reviewAssignmentId: {
        in: [71, 72],
      },
    });
  });

  it("uses an empty assignment predicate when reviewer owns none", async () => {
    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "truvern-reviewer",
      role: "TRUVERN_REVIEWER",
      organizationId: null,
      vendorId: null,
    });

    mocks.reviewAssignmentFindMany.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.groupWorkflowQueueItems).toHaveBeenCalledWith({
      reviewAssignmentId: {
        in: [],
      },
    });
  });
});
