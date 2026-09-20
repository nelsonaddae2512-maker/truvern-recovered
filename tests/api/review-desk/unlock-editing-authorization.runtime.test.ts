import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/review-desk/reviews/[id]/unlock-editing/route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isTruvernOperator: vi.fn(),
  findLatestReviewResponse: vi.fn(),
  updateReviewResponse: vi.fn(),
  updateReviewAssignment: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/truvern-ops-access", () => ({
  isTruvernOperator: mocks.isTruvernOperator,
}));

vi.mock("@/lib/repositories/review-response-repository", () => ({
  findLatestReviewResponse: mocks.findLatestReviewResponse,
  updateReviewResponse: mocks.updateReviewResponse,
}));

vi.mock("@/lib/repositories/review-assignment-repository", () => ({
  updateReviewAssignment: mocks.updateReviewAssignment,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mocks.transaction,
  },
}));

function context(id = "41") {
  return { params: Promise.resolve({ id }) };
}

function request(body: unknown = {
  acknowledged: true,
  reason: "Reviewer correction required",
}) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("unlock editing authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-ops" });
    mocks.isTruvernOperator.mockResolvedValue(true);
    mocks.transaction.mockImplementation(async (callback: any) =>
      callback({}),
    );
  });

  it("returns 401 when unauthenticated without operator check or mutation", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const response = await POST(request(), context());

    expect(response.status).toBe(401);
    expect(mocks.isTruvernOperator).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateReviewResponse).not.toHaveBeenCalled();
    expect(mocks.updateReviewAssignment).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated non-operator without mutation", async () => {
    mocks.isTruvernOperator.mockResolvedValue(false);

    const response = await POST(request(), context());

    expect(response.status).toBe(403);
    expect(mocks.isTruvernOperator).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateReviewResponse).not.toHaveBeenCalled();
    expect(mocks.updateReviewAssignment).not.toHaveBeenCalled();
  });
});
