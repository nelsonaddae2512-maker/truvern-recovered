import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requireReviewerAccess: vi.fn(),
  getGovernanceActor: vi.fn(),
  governanceAuthErrorResponse: vi.fn(),
  governanceForbidden: vi.fn(),
  findFirstAssessmentRun: vi.fn(),
  reopenAssessmentRun: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
  getGovernanceActor: mocks.getGovernanceActor,
}));

vi.mock("@/lib/auth/governance-auth-errors", () => ({
  governanceAuthErrorResponse: mocks.governanceAuthErrorResponse,
  governanceForbidden: mocks.governanceForbidden,
}));

vi.mock("@/lib/repositories/assessment-run-repository", () => ({
  findFirstAssessmentRun: mocks.findFirstAssessmentRun,
}));

vi.mock("@/lib/services/review-reopen-service", () => ({
  reopenAssessmentRun: mocks.reopenAssessmentRun,
}));

import { POST } from "../../../app/api/assessment-runs/[id]/reopen/route";

function context(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

async function readBody(response: Response) {
  return await response.json() as Record<string, unknown>;
}

describe("assessment run reopen authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.auth.mockResolvedValue({ userId: "user-1" });
    mocks.requireReviewerAccess.mockResolvedValue(undefined);
    mocks.getGovernanceActor.mockResolvedValue({
      userId: "user-1",
      role: "ADMIN",
      organizationId: 10,
    });
    mocks.findFirstAssessmentRun.mockResolvedValue({
      id: 7,
      organizationId: 10,
    });
    mocks.reopenAssessmentRun.mockResolvedValue({
      status: 200,
      body: { ok: true },
    });
    mocks.governanceAuthErrorResponse.mockReturnValue(null);
    mocks.governanceForbidden.mockImplementation((message: string) => {
      const error = new Error(message);
      Object.assign(error, { code: "FORBIDDEN" });
      return error;
    });
  });

  it("returns 400 for an invalid run id before authorization or mutation", async () => {
    const response = await POST(
      new Request("http://localhost/api/assessment-runs/nope/reopen", { method: "POST" }),
      context("nope"),
    );

    expect(response.status).toBe(400);
    expect(mocks.requireReviewerAccess).not.toHaveBeenCalled();
    expect(mocks.getGovernanceActor).not.toHaveBeenCalled();
    expect(mocks.findFirstAssessmentRun).not.toHaveBeenCalled();
    expect(mocks.reopenAssessmentRun).not.toHaveBeenCalled();
  });

  it("maps reviewer authorization failure before resource lookup or mutation", async () => {
    const authError = new Error("unauthorized");
    mocks.requireReviewerAccess.mockRejectedValue(authError);

    const mapped = new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
    mocks.governanceAuthErrorResponse.mockReturnValue(mapped);

    const response = await POST(
      new Request("http://localhost/api/assessment-runs/7/reopen", { method: "POST" }),
      context("7"),
    );

    expect(response.status).toBe(401);
    expect(mocks.governanceAuthErrorResponse).toHaveBeenCalledWith(authError);
    expect(mocks.findFirstAssessmentRun).not.toHaveBeenCalled();
    expect(mocks.reopenAssessmentRun).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing run before reopen mutation", async () => {
    mocks.findFirstAssessmentRun.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/assessment-runs/44/reopen", { method: "POST" }),
      context("44"),
    );

    expect(response.status).toBe(404);
    expect(await readBody(response)).toMatchObject({
      ok: false,
      error: "Assessment run not found.",
    });
    expect(mocks.findFirstAssessmentRun).toHaveBeenCalledWith({
      where: { id: 44 },
      select: { id: true, organizationId: true },
    });
    expect(mocks.reopenAssessmentRun).not.toHaveBeenCalled();
  });

  it("denies a reviewer from another organization and never reopens", async () => {
    mocks.getGovernanceActor.mockResolvedValue({
      userId: "user-2",
      role: "ADMIN",
      organizationId: 99,
    });

    const forbiddenError = new Error("cross-org");
    Object.assign(forbiddenError, { code: "FORBIDDEN" });
    mocks.governanceForbidden.mockReturnValue(forbiddenError);

    const mapped = new Response(
      JSON.stringify({ ok: false, error: "Forbidden" }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
    mocks.governanceAuthErrorResponse.mockReturnValue(mapped);

    const response = await POST(
      new Request("http://localhost/api/assessment-runs/7/reopen", { method: "POST" }),
      context("7"),
    );

    expect(response.status).toBe(403);
    expect(mocks.governanceForbidden).toHaveBeenCalled();
    expect(mocks.governanceAuthErrorResponse).toHaveBeenCalledWith(forbiddenError);
    expect(mocks.reopenAssessmentRun).not.toHaveBeenCalled();
  });

  it("allows a same-organization reviewer to reopen the run", async () => {
    const response = await POST(
      new Request("http://localhost/api/assessment-runs/7/reopen", { method: "POST" }),
      context("7"),
    );

    expect(response.status).toBe(200);
    expect(mocks.requireReviewerAccess).toHaveBeenCalledTimes(1);
    expect(mocks.getGovernanceActor).toHaveBeenCalledTimes(1);
    expect(mocks.reopenAssessmentRun).toHaveBeenCalledWith({
      assessmentRunId: 7,
      actorUserId: "user-1",
    });
  });

  it("allows OPS across organizations", async () => {
    mocks.getGovernanceActor.mockResolvedValue({
      userId: "ops-1",
      role: "OPS",
      organizationId: 999,
    });
    mocks.auth.mockResolvedValue({ userId: "ops-1" });

    const response = await POST(
      new Request("http://localhost/api/assessment-runs/7/reopen", { method: "POST" }),
      context("7"),
    );

    expect(response.status).toBe(200);
    expect(mocks.governanceForbidden).not.toHaveBeenCalled();
    expect(mocks.reopenAssessmentRun).toHaveBeenCalledWith({
      assessmentRunId: 7,
      actorUserId: "ops-1",
    });
  });

  it("preserves non-governance reopen failures as 500", async () => {
    mocks.reopenAssessmentRun.mockRejectedValue(new Error("reopen exploded"));

    const response = await POST(
      new Request("http://localhost/api/assessment-runs/7/reopen", { method: "POST" }),
      context("7"),
    );

    expect(response.status).toBe(500);
    expect(await readBody(response)).toMatchObject({
      ok: false,
      error: "reopen exploded",
    });
  });
});
