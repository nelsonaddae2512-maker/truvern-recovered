import { beforeEach, describe, expect, it, vi } from "vitest";
import { governanceForbidden } from "@/lib/auth/governance-auth-errors";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess: vi.fn(),
  requireReviewAssignmentAccess: vi.fn(),
  readWorkflowTaskForAuthorization: vi.fn(),
  claimWorkflowTask: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: mocks.currentUser,
}));
vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
  requireReviewAssignmentAccess: mocks.requireReviewAssignmentAccess,
}));

vi.mock("@/lib/repositories/workflow-task-repository", () => ({
  readWorkflowTaskForAuthorization: mocks.readWorkflowTaskForAuthorization,
}));

vi.mock("@/lib/workflow/workflow-task-engine", () => ({
  claimWorkflowTask: mocks.claimWorkflowTask,
}));

import { POST } from "@/app/api/review-desk/workflow-tasks/[id]/claim/route";

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function actor(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user_customer_1",
    organizationId: 7,
    vendorId: null,
    role: "ADMIN",
    ...overrides,
  };
}

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 51,
    reviewAssignmentId: 42,
    organizationId: 7,
    assignedTo: null,
    status: "OPEN",
    type: "REVIEW",
    ...overrides,
  };
}

describe("workflow task claim authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireReviewerAccess.mockResolvedValue(actor());
    mocks.requireReviewAssignmentAccess.mockResolvedValue(actor());
    mocks.readWorkflowTaskForAuthorization.mockResolvedValue([task()]);
    mocks.claimWorkflowTask.mockResolvedValue({ id: 51, status: "CLAIMED" });
    mocks.currentUser.mockResolvedValue({
      fullName: "Authenticated Reviewer",
      firstName: "Authenticated",
      lastName: "Reviewer",
      primaryEmailAddress: {
        emailAddress: "reviewer@example.test",
      },
    });
  });

  it.each(["abc", "0", "-1"])(
    "returns 400 for invalid task id %s without task read or mutation",
    async (id) => {
      const response = await POST(new Request("http://localhost"), context(id));
      expect(response.status).toBe(400);
      expect(mocks.readWorkflowTaskForAuthorization).not.toHaveBeenCalled();
      expect(mocks.claimWorkflowTask).not.toHaveBeenCalled();
    },
  );

  it("returns 404 when the task does not exist", async () => {
    mocks.readWorkflowTaskForAuthorization.mockResolvedValue([]);
    const response = await POST(new Request("http://localhost"), context("51"));
    expect(response.status).toBe(404);
    expect(mocks.claimWorkflowTask).not.toHaveBeenCalled();
  });

  it("authorizes an assignment-backed task before claiming it", async () => {
    const response = await POST(new Request("http://localhost"), context("51"));
    expect(response.status).toBe(200);
    expect(mocks.requireReviewAssignmentAccess).toHaveBeenCalledWith(42);
    expect(mocks.claimWorkflowTask).toHaveBeenCalledTimes(1);
  });

  it("maps denied assignment access to 403 and does not mutate", async () => {
    mocks.requireReviewAssignmentAccess.mockRejectedValue(
      governanceForbidden("Review assignment access denied."),
    );
    const response = await POST(new Request("http://localhost"), context("51"));
    expect(response.status).toBe(403);
    expect(mocks.claimWorkflowTask).not.toHaveBeenCalled();
  });

  it("permits same-organization fallback when no assignment exists", async () => {
    mocks.readWorkflowTaskForAuthorization.mockResolvedValue([
      task({ reviewAssignmentId: null, organizationId: 7 }),
    ]);
    const response = await POST(new Request("http://localhost"), context("51"));
    expect(response.status).toBe(200);
    expect(mocks.requireReviewAssignmentAccess).not.toHaveBeenCalled();
    expect(mocks.claimWorkflowTask).toHaveBeenCalledTimes(1);
  });

  it("denies cross-organization fallback without mutation", async () => {
    mocks.readWorkflowTaskForAuthorization.mockResolvedValue([
      task({ reviewAssignmentId: null, organizationId: 99 }),
    ]);
    const response = await POST(new Request("http://localhost"), context("51"));
    expect(response.status).toBe(403);
    expect(mocks.claimWorkflowTask).not.toHaveBeenCalled();
  });

  it("denies unassigned fallback tasks to Truvern reviewers", async () => {
    mocks.requireReviewerAccess.mockResolvedValue(
      actor({
        userId: "user_reviewer_1",
        organizationId: null,
        role: "TRUVERN_REVIEWER",
      }),
    );
    mocks.readWorkflowTaskForAuthorization.mockResolvedValue([
      task({ reviewAssignmentId: null, organizationId: 7 }),
    ]);
    const response = await POST(new Request("http://localhost"), context("51"));
    expect(response.status).toBe(403);
    expect(mocks.claimWorkflowTask).not.toHaveBeenCalled();
  });

  it("uses authenticated actor identity for the claim", async () => {
    mocks.requireReviewerAccess.mockResolvedValue(
      actor({ userId: "user_authenticated_9", role: "ADMIN" }),
    );
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reviewerId: "spoofed_reviewer",
        reviewerName: "Spoofed Name",
      }),
    });
    const response = await POST(request, context("51"));
    expect(response.status).toBe(200);
    expect(mocks.claimWorkflowTask).toHaveBeenCalledWith({
      taskId: 51,
      reviewerId: "user_authenticated_9",
      reviewerName: "Authenticated Reviewer",
    });
  });

  it("uses first and last name when Clerk fullName is unavailable", async () => {
    mocks.currentUser.mockResolvedValue({
      fullName: null,
      firstName: "Casey",
      lastName: "Reviewer",
      primaryEmailAddress: { emailAddress: "casey@example.test" },
    });

    const response = await POST(new Request("http://localhost"), context("51"));

    expect(response.status).toBe(200);
    expect(mocks.claimWorkflowTask).toHaveBeenCalledWith({
      taskId: 51,
      reviewerId: "user_customer_1",
      reviewerName: "Casey Reviewer",
    });
  });

  it("falls back to Clerk email when no display name is available", async () => {
    mocks.currentUser.mockResolvedValue({
      fullName: null,
      firstName: null,
      lastName: null,
      primaryEmailAddress: { emailAddress: "identity@example.test" },
    });

    const response = await POST(new Request("http://localhost"), context("51"));

    expect(response.status).toBe(200);
    expect(mocks.claimWorkflowTask).toHaveBeenCalledWith({
      taskId: 51,
      reviewerId: "user_customer_1",
      reviewerName: "identity@example.test",
    });
  });

  it("uses a neutral fallback when Clerk has no display identity", async () => {
    mocks.currentUser.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost"), context("51"));

    expect(response.status).toBe(200);
    expect(mocks.claimWorkflowTask).toHaveBeenCalledWith({
      taskId: 51,
      reviewerId: "user_customer_1",
      reviewerName: "Internal reviewer",
    });
  });
});
