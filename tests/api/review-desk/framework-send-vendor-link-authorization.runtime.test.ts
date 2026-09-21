import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess: vi.fn(),
  requireReviewAssignmentAccess: vi.fn(),
  requireFrameworkAssessmentAccess: vi.fn(),
  governanceAuthErrorResponse: vi.fn(),
  findAssessment: vi.fn(),
  sendVendorLink: vi.fn(),
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
  requireReviewAssignmentAccess:
    mocks.requireReviewAssignmentAccess,
  requireFrameworkAssessmentAccess:
    mocks.requireFrameworkAssessmentAccess,
}));

vi.mock("@/lib/auth/governance-auth-errors", () => ({
  governanceAuthErrorResponse:
    mocks.governanceAuthErrorResponse,
}));

vi.mock("@/lib/repositories/truvern-framework-assessment-repository", () => ({
  findTruvernFrameworkAssessment:
    mocks.findAssessment,
}));

vi.mock("@/lib/communications/framework-assessment-vendor-link", () => ({
  sendFrameworkAssessmentVendorLink:
    mocks.sendVendorLink,
}));

import { POST } from "../../../app/api/truvern/framework-assessments/[id]/send-vendor-link/route";

function request() {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      recipients: ["vendor@example.com"],
    }),
  });
}

function params(id = "41") {
  return {
    params: Promise.resolve({ id }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.requireReviewerAccess.mockResolvedValue({
    userId: "reviewer-1",
  });

  mocks.requireReviewAssignmentAccess.mockResolvedValue({
    id: 91,
  });

  mocks.requireFrameworkAssessmentAccess.mockResolvedValue({
    id: 41,
  });

  mocks.governanceAuthErrorResponse.mockReturnValue(null);

  mocks.sendVendorLink.mockResolvedValue({
    provider: "test",
    recipients: ["vendor@example.com"],
    vendorUrl: "https://example.test/vendor",
    assessmentId: 41,
    mailboxId: 1,
    conversationId: 2,
    messageId: 3,
    providerMessageId: "provider-1",
    simulated: true,
  });
});

describe("framework send-vendor-link authorization", () => {
  it("returns 404 before resource authorization when assessment is missing", async () => {
    mocks.findAssessment.mockResolvedValue(null);

    const response = await POST(
      request(),
      params(),
    );

    expect(response.status).toBe(404);
    expect(mocks.requireReviewAssignmentAccess)
      .not.toHaveBeenCalled();
    expect(mocks.requireFrameworkAssessmentAccess)
      .not.toHaveBeenCalled();
    expect(mocks.sendVendorLink)
      .not.toHaveBeenCalled();
  });

  it("authorizes linked assessments through the review assignment", async () => {
    mocks.findAssessment.mockResolvedValue({
      id: 41,
      reviewAssignmentId: 91,
    });

    const response = await POST(
      request(),
      params(),
    );

    expect(response.status).toBe(200);
    expect(mocks.requireReviewAssignmentAccess)
      .toHaveBeenCalledWith(91);
    expect(mocks.requireFrameworkAssessmentAccess)
      .not.toHaveBeenCalled();
    expect(mocks.sendVendorLink)
      .toHaveBeenCalledTimes(1);
  });

  it("authorizes unlinked assessments through framework access", async () => {
    mocks.findAssessment.mockResolvedValue({
      id: 41,
      reviewAssignmentId: null,
    });

    const response = await POST(
      request(),
      params(),
    );

    expect(response.status).toBe(200);
    expect(mocks.requireFrameworkAssessmentAccess)
      .toHaveBeenCalledWith(41);
    expect(mocks.requireReviewAssignmentAccess)
      .not.toHaveBeenCalled();
    expect(mocks.sendVendorLink)
      .toHaveBeenCalledTimes(1);
  });

  it("maps assignment authorization failures and does not send", async () => {
    const authFailure = new Error("forbidden");

    mocks.findAssessment.mockResolvedValue({
      id: 41,
      reviewAssignmentId: 91,
    });

    mocks.requireReviewAssignmentAccess
      .mockRejectedValue(authFailure);

    mocks.governanceAuthErrorResponse
      .mockImplementation((error) =>
        error === authFailure
          ? Response.json(
              { ok: false, error: "Forbidden." },
              { status: 403 },
            )
          : null,
      );

    const response = await POST(
      request(),
      params(),
    );

    expect(response.status).toBe(403);
    expect(mocks.sendVendorLink)
      .not.toHaveBeenCalled();
  });

  it("maps framework authorization failures and does not send", async () => {
    const authFailure = new Error("forbidden");

    mocks.findAssessment.mockResolvedValue({
      id: 41,
      reviewAssignmentId: null,
    });

    mocks.requireFrameworkAssessmentAccess
      .mockRejectedValue(authFailure);

    mocks.governanceAuthErrorResponse
      .mockImplementation((error) =>
        error === authFailure
          ? Response.json(
              { ok: false, error: "Forbidden." },
              { status: 403 },
            )
          : null,
      );

    const response = await POST(
      request(),
      params(),
    );

    expect(response.status).toBe(403);
    expect(mocks.sendVendorLink)
      .not.toHaveBeenCalled();
  });

  it("maps broad reviewer authorization failures and does not read or send", async () => {
    const authFailure = new Error("unauthorized");

    mocks.requireReviewerAccess
      .mockRejectedValue(authFailure);

    mocks.governanceAuthErrorResponse
      .mockImplementation((error) =>
        error === authFailure
          ? Response.json(
              { ok: false, error: "Unauthorized." },
              { status: 401 },
            )
          : null,
      );

    const response = await POST(
      request(),
      params(),
    );

    expect(response.status).toBe(401);
    expect(mocks.findAssessment)
      .not.toHaveBeenCalled();
    expect(mocks.sendVendorLink)
      .not.toHaveBeenCalled();
  });
});
