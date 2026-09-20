import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as approve } from "@/app/api/review-desk/remediation-requests/[id]/approve/route";
import { POST as reject } from "@/app/api/review-desk/remediation-requests/[id]/reject/route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isTruvernOperator: vi.fn(),
  findEvidenceRequest: vi.fn(),
  updateEvidenceRequest: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/truvern-ops-access", () => ({
  isTruvernOperator: mocks.isTruvernOperator,
}));

vi.mock("@/lib/repositories/evidence-request-repository", () => ({
  findEvidenceRequest: mocks.findEvidenceRequest,
  updateEvidenceRequest: mocks.updateEvidenceRequest,
}));

vi.mock("@/lib/prisma", () => ({
  default: {},
}));

function context(id = "41") {
  return { params: Promise.resolve({ id }) };
}

function request() {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason: "Reviewed" }),
  });
}

describe.each([
  ["approve", approve],
  ["reject", reject],
])("remediation %s authorization", (_name, handler) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-ops" });
    mocks.isTruvernOperator.mockResolvedValue(true);
  });

  it("returns 401 when unauthenticated without operator check or mutation", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const response = await handler(request(), context());

    expect(response.status).toBe(401);
    expect(mocks.isTruvernOperator).not.toHaveBeenCalled();
    expect(mocks.findEvidenceRequest).not.toHaveBeenCalled();
    expect(mocks.updateEvidenceRequest).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated non-operator without mutation", async () => {
    mocks.isTruvernOperator.mockResolvedValue(false);

    const response = await handler(request(), context());

    expect(response.status).toBe(403);
    expect(mocks.isTruvernOperator).toHaveBeenCalledTimes(1);
    expect(mocks.findEvidenceRequest).not.toHaveBeenCalled();
    expect(mocks.updateEvidenceRequest).not.toHaveBeenCalled();
  });
});
