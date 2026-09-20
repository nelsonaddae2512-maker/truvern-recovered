import { beforeEach, describe, expect, it, vi } from "vitest";
import { governanceForbidden } from "@/lib/auth/governance-auth-errors";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess: vi.fn(),
  requireReviewAssignmentAccess: vi.fn(),
  readWorkflowTaskForAuthorization: vi.fn(),
  completeWorkflowTask: vi.fn(),
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
  requireReviewAssignmentAccess: mocks.requireReviewAssignmentAccess,
}));

vi.mock("@/lib/repositories/workflow-task-repository", () => ({
  readWorkflowTaskForAuthorization: mocks.readWorkflowTaskForAuthorization,
}));

vi.mock("@/lib/workflow/workflow-task-engine", () => ({
  completeWorkflowTask: mocks.completeWorkflowTask,
}));

import { POST } from "@/app/api/review-desk/workflow-tasks/[id]/complete/route";

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
    status: "CLAIMED",
    type: "REVIEW",
    ...overrides,
  };
}

function request(body: unknown = { result: "COMPLETED", notes: "done" }) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("workflow task complete authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireReviewerAccess.mockResolvedValue(actor());
    mocks.requireReviewAssignmentAccess.mockResolvedValue(actor());
    mocks.readWorkflowTaskForAuthorization.mockResolvedValue([task()]);
    mocks.completeWorkflowTask.mockResolvedValue({ id: 51, status: "COMPLETED" });
  });

  it.each(["abc", "0", "-1"])(
    "returns 400 for invalid task id %s without task read or mutation",
    async (id) => {
      const response = await POST(request(), context(id));
      expect(response.status).toBe(400);
      expect(mocks.readWorkflowTaskForAuthorization).not.toHaveBeenCalled();
      expect(mocks.completeWorkflowTask).not.toHaveBeenCalled();
    },
  );

  it("returns 404 when the task does not exist", async () => {
    mocks.readWorkflowTaskForAuthorization.mockResolvedValue([]);
    const response = await POST(request(), context("51"));
    expect(response.status).toBe(404);
    expect(mocks.completeWorkflowTask).not.toHaveBeenCalled();
  });

  it("authorizes an assignment-backed task before completing it", async () => {
    const response = await POST(request(), context("51"));
    expect(response.status).toBe(200);
    expect(mocks.requireReviewAssignmentAccess).toHaveBeenCalledWith(42);
    expect(mocks.completeWorkflowTask).toHaveBeenCalledWith({
      taskId: 51,
      result: "COMPLETED",
      notes: "done",
    });
  });

  it("maps denied assignment access to 403 without mutation", async () => {
    mocks.requireReviewAssignmentAccess.mockRejectedValue(
      governanceForbidden("Review assignment access denied."),
    );
    const response = await POST(request(), context("51"));
    expect(response.status).toBe(403);
    expect(mocks.completeWorkflowTask).not.toHaveBeenCalled();
  });

  it("does not parse the request body when assignment authorization fails", async () => {
    mocks.requireReviewAssignmentAccess.mockRejectedValue(
      governanceForbidden("Review assignment access denied."),
    );
    const bodyRead = vi.fn();
    const guardedRequest = {
      json: bodyRead,
    } as unknown as Request;
    const response = await POST(guardedRequest, context("51"));
    expect(response.status).toBe(403);
    expect(bodyRead).not.toHaveBeenCalled();
    expect(mocks.completeWorkflowTask).not.toHaveBeenCalled();
  });

  it("permits same-organization fallback when no assignment exists", async () => {
    mocks.readWorkflowTaskForAuthorization.mockResolvedValue([
      task({ reviewAssignmentId: null, organizationId: 7 }),
    ]);
    const response = await POST(request(), context("51"));
    expect(response.status).toBe(200);
    expect(mocks.requireReviewAssignmentAccess).not.toHaveBeenCalled();
    expect(mocks.completeWorkflowTask).toHaveBeenCalledTimes(1);
  });

  it("denies cross-organization fallback without mutation", async () => {
    mocks.readWorkflowTaskForAuthorization.mockResolvedValue([
      task({ reviewAssignmentId: null, organizationId: 99 }),
    ]);
    const response = await POST(request(), context("51"));
    expect(response.status).toBe(403);
    expect(mocks.completeWorkflowTask).not.toHaveBeenCalled();
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
    const response = await POST(request(), context("51"));
    expect(response.status).toBe(403);
    expect(mocks.completeWorkflowTask).not.toHaveBeenCalled();
  });
});
