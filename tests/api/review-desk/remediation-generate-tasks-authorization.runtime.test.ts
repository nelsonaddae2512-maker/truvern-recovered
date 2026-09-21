import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess: vi.fn(),
  requireReviewAssignmentAccess: vi.fn(),
  governanceAuthErrorResponse: vi.fn(),
  readWorkflowTaskPackage: vi.fn(),
  generateWorkflowTasksForPackage: vi.fn(),
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
  requireReviewAssignmentAccess: mocks.requireReviewAssignmentAccess,
}));

vi.mock("@/lib/auth/governance-auth-errors", () => ({
  governanceAuthErrorResponse: mocks.governanceAuthErrorResponse,
}));

vi.mock("@/lib/repositories/workflow-task-repository", () => ({
  readWorkflowTaskPackage: mocks.readWorkflowTaskPackage,
}));

vi.mock("@/lib/workflow/workflow-task-engine", () => ({
  generateWorkflowTasksForPackage: mocks.generateWorkflowTasksForPackage,
}));

import { POST } from "../../../app/api/review-desk/remediation-packages/[id]/generate-tasks/route";

function props(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("remediation generate-tasks authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "user-1",
      organizationId: 10,
      vendorId: null,
      role: "ANALYST",
    });
    mocks.governanceAuthErrorResponse.mockReturnValue(null);
    mocks.readWorkflowTaskPackage.mockResolvedValue([
      {
        id: 7,
        reviewAssignmentId: 44,
        vendorId: 20,
        organizationId: 10,
      },
    ]);
    mocks.requireReviewAssignmentAccess.mockResolvedValue({
      id: 44,
    });
    mocks.generateWorkflowTasksForPackage.mockResolvedValue({
      ok: true,
      created: 2,
    });
  });

  it("returns 400 for an invalid package id before resource lookup", async () => {
    const response = await POST(new Request("http://localhost"), props("0"));

    expect(response.status).toBe(400);
    expect(mocks.readWorkflowTaskPackage).not.toHaveBeenCalled();
    expect(mocks.requireReviewAssignmentAccess).not.toHaveBeenCalled();
    expect(mocks.generateWorkflowTasksForPackage).not.toHaveBeenCalled();
  });

  it("returns 404 before assignment authorization when the package does not exist", async () => {
    mocks.readWorkflowTaskPackage.mockResolvedValue([]);

    const response = await POST(new Request("http://localhost"), props("7"));

    expect(response.status).toBe(404);
    expect(mocks.requireReviewAssignmentAccess).not.toHaveBeenCalled();
    expect(mocks.generateWorkflowTasksForPackage).not.toHaveBeenCalled();
  });

  it("authorizes the package review assignment before generation", async () => {
    const response = await POST(new Request("http://localhost"), props("7"));

    expect(response.status).toBe(200);
    expect(mocks.requireReviewAssignmentAccess).toHaveBeenCalledWith(44);
    expect(mocks.generateWorkflowTasksForPackage).toHaveBeenCalledWith({
      packageId: 7,
      actor: "TRUVERN_REVIEWER",
    });

    const authOrder =
      mocks.requireReviewAssignmentAccess.mock.invocationCallOrder[0];
    const generationOrder =
      mocks.generateWorkflowTasksForPackage.mock.invocationCallOrder[0];

    expect(authOrder).toBeLessThan(generationOrder);
  });

  it("does not generate tasks when assignment authorization fails", async () => {
    const denial = new Error("Forbidden");
    mocks.requireReviewAssignmentAccess.mockRejectedValue(denial);
    mocks.governanceAuthErrorResponse.mockImplementation((error: unknown) => {
      if (error === denial) {
        return Response.json(
          { ok: false, error: "Forbidden" },
          { status: 403 },
        );
      }

      return null;
    });

    const response = await POST(new Request("http://localhost"), props("7"));

    expect(response.status).toBe(403);
    expect(mocks.generateWorkflowTasksForPackage).not.toHaveBeenCalled();
  });

  it("maps broad reviewer authorization failures through the canonical mapper", async () => {
    const denial = new Error("Unauthorized");
    mocks.requireReviewerAccess.mockRejectedValue(denial);
    mocks.governanceAuthErrorResponse.mockImplementation((error: unknown) => {
      if (error === denial) {
        return Response.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 },
        );
      }

      return null;
    });

    const response = await POST(new Request("http://localhost"), props("7"));

    expect(response.status).toBe(401);
    expect(mocks.readWorkflowTaskPackage).not.toHaveBeenCalled();
    expect(mocks.requireReviewAssignmentAccess).not.toHaveBeenCalled();
    expect(mocks.generateWorkflowTasksForPackage).not.toHaveBeenCalled();
  });

  it("preserves non-governance failures as server errors", async () => {
    mocks.generateWorkflowTasksForPackage.mockRejectedValue(
      new Error("generation failed"),
    );

    const response = await POST(new Request("http://localhost"), props("7"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("generation failed");
  });
});
