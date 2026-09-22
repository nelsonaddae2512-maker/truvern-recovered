import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess: vi.fn(),
  requireReviewAssignmentAccess: vi.fn(),
  findEvidenceRequests: vi.fn(),
  findEvidence: vi.fn(),
  createEvidenceDownloadUrl: vi.fn(),
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
  requireReviewAssignmentAccess: mocks.requireReviewAssignmentAccess,
}));

vi.mock("@/lib/auth/governance-auth-errors", () => ({
  governanceAuthErrorResponse: (error: any) => {
    if (error?.status === 401 || error?.status === 403) {
      return Response.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }

    return null;
  },
}));

vi.mock("@/lib/repositories/evidence-request-repository", () => ({
  findEvidenceRequests: mocks.findEvidenceRequests,
}));

vi.mock("@/lib/repositories/evidence-repository", () => ({
  findEvidence: mocks.findEvidence,
}));

vi.mock("@/lib/storage/evidence-storage", () => ({
  createEvidenceDownloadUrl: mocks.createEvidenceDownloadUrl,
}));

vi.mock("@/lib/prisma", () => ({
  default: {},
}));

import { GET } from "@/app/api/review-desk/vendors/[vendorId]/evidence-submissions/route";

function context(vendorId: string) {
  return {
    params: Promise.resolve({ vendorId }),
  };
}

function request(assignmentId?: number) {
  const url = new URL(
    "https://truvern.test/api/review-desk/vendors/20/evidence-submissions",
  );

  if (assignmentId != null) {
    url.searchParams.set("assignmentId", String(assignmentId));
  }

  return new Request(url);
}

describe("review-desk evidence submissions authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "reviewer-1",
      organizationId: 10,
      vendorId: null,
      role: "ADMIN",
    });

    mocks.requireReviewAssignmentAccess.mockResolvedValue({
      actor: {
        userId: "reviewer-1",
        organizationId: 10,
        vendorId: null,
        role: "ADMIN",
      },
      assignment: {
        id: 41,
        organizationId: 10,
        vendorId: 20,
        assignmentType: "INTERNAL",
        reviewerUserId: "reviewer-1",
      },
    });

    mocks.findEvidenceRequests.mockResolvedValue([]);
    mocks.findEvidence.mockResolvedValue([]);
    mocks.createEvidenceDownloadUrl.mockResolvedValue(
      "https://signed.example/evidence",
    );
  });

  it("requires an assignment id before evidence lookup", async () => {
    const response = await GET(request(), context("20"));

    expect(response.status).toBe(400);
    expect(mocks.requireReviewAssignmentAccess).not.toHaveBeenCalled();
    expect(mocks.findEvidenceRequests).not.toHaveBeenCalled();
    expect(mocks.findEvidence).not.toHaveBeenCalled();
    expect(mocks.createEvidenceDownloadUrl).not.toHaveBeenCalled();
  });

  it("authorizes the requested review assignment before evidence lookup", async () => {
    const response = await GET(request(41), context("20"));

    expect(response.status).toBe(200);
    expect(mocks.requireReviewAssignmentAccess).toHaveBeenCalledWith(41);
    expect(mocks.findEvidenceRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vendorId: 20,
        },
      }),
    );
  });

  it("rejects a vendor that does not belong to the authorized assignment", async () => {
    mocks.requireReviewAssignmentAccess.mockResolvedValue({
      actor: {
        userId: "reviewer-1",
        organizationId: 10,
        vendorId: null,
        role: "ADMIN",
      },
      assignment: {
        id: 41,
        organizationId: 10,
        vendorId: 99,
        assignmentType: "INTERNAL",
        reviewerUserId: "reviewer-1",
      },
    });

    const response = await GET(request(41), context("20"));

    expect(response.status).toBe(403);
    expect(mocks.findEvidenceRequests).not.toHaveBeenCalled();
    expect(mocks.findEvidence).not.toHaveBeenCalled();
    expect(mocks.createEvidenceDownloadUrl).not.toHaveBeenCalled();
  });

  it("stops when assignment authorization denies access", async () => {
    mocks.requireReviewAssignmentAccess.mockRejectedValue(
      Object.assign(
        new Error("Review assignment access denied."),
        { status: 403 },
      ),
    );

    const response = await GET(request(41), context("20"));

    expect(response.status).toBe(403);
    expect(mocks.findEvidenceRequests).not.toHaveBeenCalled();
    expect(mocks.findEvidence).not.toHaveBeenCalled();
    expect(mocks.createEvidenceDownloadUrl).not.toHaveBeenCalled();
  });
});