import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isTruvernOperator: vi.fn(),
  findEvidenceRequest: vi.fn(),
  updateEvidenceRequestReviewStatus: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/truvern-ops-access", () => ({
  isTruvernOperator: mocks.isTruvernOperator,
}));

vi.mock("@/lib/repositories/evidence-request-repository", () => ({
  findEvidenceRequest: mocks.findEvidenceRequest,
}));

vi.mock(
  "@/lib/repositories/evidence-request-review-repository",
  () => ({
    updateEvidenceRequestReviewStatus:
      mocks.updateEvidenceRequestReviewStatus,
  }),
);

import { POST } from "@/app/api/evidence-requests/[id]/review/route";

function request(action = "APPROVE") {
  return new Request(
    "http://localhost/api/evidence-requests/1/review",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ action }),
    },
  ) as never;
}

function context(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

describe("evidence request review route guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.auth.mockResolvedValue({
      userId: "user_1",
    });

    mocks.isTruvernOperator.mockResolvedValue(true);

    mocks.findEvidenceRequest.mockResolvedValue({
      id: 1,
    });

    mocks.updateEvidenceRequestReviewStatus.mockResolvedValue({
      id: 1,
      status: "APPROVED",
      reviewedAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue({
      userId: null,
    });

    const response =
      await POST(request(), context("1"));

    expect(response.status).toBe(401);
    expect(mocks.isTruvernOperator).not.toHaveBeenCalled();
    expect(mocks.findEvidenceRequest).not.toHaveBeenCalled();
    expect(
      mocks.updateEvidenceRequestReviewStatus,
    ).not.toHaveBeenCalled();
  });

  it("returns 403 for an authenticated non-Truvern operator", async () => {
    mocks.isTruvernOperator.mockResolvedValue(false);

    const response =
      await POST(request(), context("1"));

    expect(response.status).toBe(403);
    expect(mocks.findEvidenceRequest).not.toHaveBeenCalled();
    expect(
      mocks.updateEvidenceRequestReviewStatus,
    ).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-1"])(
    "returns 400 for invalid evidence request id %s",
    async (id) => {
      const response =
        await POST(request(), context(id));

      expect(response.status).toBe(400);
      expect(mocks.findEvidenceRequest).not.toHaveBeenCalled();
      expect(
        mocks.updateEvidenceRequestReviewStatus,
      ).not.toHaveBeenCalled();
    },
  );

  it("returns 404 when the evidence request does not exist", async () => {
    mocks.findEvidenceRequest.mockResolvedValue(null);

    const response =
      await POST(request(), context("999999"));

    expect(response.status).toBe(404);

    expect(mocks.findEvidenceRequest).toHaveBeenCalledWith({
      where: { id: 999999 },
      select: { id: true },
    });

    expect(
      mocks.updateEvidenceRequestReviewStatus,
    ).not.toHaveBeenCalled();
  });

  it("preserves APPROVE -> APPROVED mutation", async () => {
    const response =
      await POST(request("APPROVE"), context("1"));

    expect(response.status).toBe(200);

    expect(
      mocks.updateEvidenceRequestReviewStatus,
    ).toHaveBeenCalledWith({
      id: 1,
      status: "APPROVED",
    });
  });

  it("preserves REJECT -> REJECTED mutation", async () => {
    const response =
      await POST(request("REJECT"), context("1"));

    expect(response.status).toBe(200);

    expect(
      mocks.updateEvidenceRequestReviewStatus,
    ).toHaveBeenCalledWith({
      id: 1,
      status: "REJECTED",
    });
  });

  it("preserves REOPEN -> REQUESTED mutation", async () => {
    const response =
      await POST(request("REOPEN"), context("1"));

    expect(response.status).toBe(200);

    expect(
      mocks.updateEvidenceRequestReviewStatus,
    ).toHaveBeenCalledWith({
      id: 1,
      status: "REQUESTED",
    });
  });

  it("preserves 400 for an invalid action without mutation", async () => {
    const response =
      await POST(request("INVALID"), context("1"));

    expect(response.status).toBe(400);

    expect(
      mocks.updateEvidenceRequestReviewStatus,
    ).not.toHaveBeenCalled();
  });
});