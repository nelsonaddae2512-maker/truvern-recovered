import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess: vi.fn(),
  governanceAuthErrorResponse: vi.fn(() => null),
  currentUser: vi.fn(),
  reviewAssignmentFindMany: vi.fn(),
  transaction: vi.fn(),
  findFirstWorkflowQueueItem: vi.fn(),
  findWorkflowQueueItem: vi.fn(),
  updateWorkflowQueueItems: vi.fn(),
  createWorkflowEvent: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: mocks.currentUser,
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
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/repositories/workflow-queue-repository", () => ({
  findFirstWorkflowQueueItem: mocks.findFirstWorkflowQueueItem,
  findWorkflowQueueItem: mocks.findWorkflowQueueItem,
  updateWorkflowQueueItems: mocks.updateWorkflowQueueItems,
}));

vi.mock("@/lib/repositories/workflow-event-repository", () => ({
  createWorkflowEvent: mocks.createWorkflowEvent,
}));

import { POST } from "@/app/api/review-desk/workflow-queue/claim-next/route";

describe("workflow queue claim-next authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.currentUser.mockResolvedValue({
      fullName: "Trusted Reviewer",
      firstName: "Trusted",
      lastName: "Reviewer",
      primaryEmailAddress: {
        emailAddress: "trusted@example.com",
      },
    });

    mocks.transaction.mockImplementation(async (callback: any) => {
      return callback({});
    });

    mocks.findFirstWorkflowQueueItem.mockResolvedValue(null);
  });

  it("scopes customer candidate selection to the actor organization", async () => {
    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "customer-user",
      role: "ANALYST",
      organizationId: 55,
      vendorId: null,
    });

    const response = await POST(
      new Request("http://localhost/api/review-desk/workflow-queue/claim-next", {
        method: "POST",
        body: JSON.stringify({
          reviewerId: "spoofed-user",
          reviewerName: "Spoofed Reviewer",
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(mocks.findFirstWorkflowQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { organizationId: 55 },
            {
              status: "OPEN",
              assignedTo: null,
            },
          ],
        },
      }),
      {},
    );
  });

  it("scopes Truvern reviewer candidate selection to owned Truvern assignments", async () => {
    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "truvern-user",
      role: "TRUVERN_REVIEWER",
      organizationId: null,
      vendorId: null,
    });

    mocks.reviewAssignmentFindMany.mockResolvedValue([
      { id: 81 },
      { id: 82 },
    ]);

    const response = await POST(
      new Request("http://localhost/api/review-desk/workflow-queue/claim-next", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(404);
    expect(mocks.findFirstWorkflowQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              reviewAssignmentId: {
                in: [81, 82],
              },
            },
            {
              status: "OPEN",
              assignedTo: null,
            },
          ],
        },
      }),
      {},
    );
  });

  it("uses authenticated identity and trusted display name when claiming", async () => {
    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "authenticated-user",
      role: "ANALYST",
      organizationId: 55,
      vendorId: null,
    });

    const candidate = {
      id: 91,
      workflowId: 10,
      organizationId: 55,
      vendorId: 20,
      reviewAssignmentId: null,
      status: "OPEN",
      assignedTo: null,
      payload: {},
    };

    mocks.findFirstWorkflowQueueItem.mockResolvedValue(candidate);
    mocks.updateWorkflowQueueItems.mockResolvedValue({ count: 1 });
    mocks.findWorkflowQueueItem.mockResolvedValue(candidate);
    mocks.createWorkflowEvent.mockResolvedValue({ id: 1 });

    const response = await POST(
      new Request("http://localhost/api/review-desk/workflow-queue/claim-next", {
        method: "POST",
        body: JSON.stringify({
          reviewerId: "spoofed-user",
          reviewerName: "Spoofed Reviewer",
        }),
      }),
    );

    expect(response.status).toBe(200);

    expect(mocks.updateWorkflowQueueItems).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedTo: "authenticated-user",
          payload: expect.objectContaining({
            assignedReviewerName: "Trusted Reviewer",
          }),
        }),
      }),
      {},
    );

    expect(mocks.createWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actor: "authenticated-user",
          summary: expect.stringContaining("Trusted Reviewer"),
        }),
      }),
      {},
    );
  });

  it("allows OPS candidate selection without organization restriction", async () => {
    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "ops-user",
      role: "OPS",
      organizationId: null,
      vendorId: null,
    });

    const response = await POST(
      new Request("http://localhost/api/review-desk/workflow-queue/claim-next", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(404);
    expect(mocks.findFirstWorkflowQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {},
            {
              status: "OPEN",
              assignedTo: null,
            },
          ],
        },
      }),
      {},
    );
  });
});