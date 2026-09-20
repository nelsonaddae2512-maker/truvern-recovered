import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { POST } from "@/app/api/review-desk/reviews/[id]/claim/route";


const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  isTruvernOperator: vi.fn(),
  requireReviewerAccess: vi.fn(),
  governanceAuthErrorResponse: vi.fn(),
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}));

vi.mock("@/lib/truvern-ops-access", () => ({
  isTruvernOperator: mocks.isTruvernOperator,
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
}));

// Replace the temporary mock above using the source-authoritative
// specifier discovered from the route before this test is executed.

vi.mock("@/lib/auth/governance-auth-errors", () => ({
  governanceAuthErrorResponse: mocks.governanceAuthErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  },
}));

function context(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

function assignment(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 41,
    status: "PENDING",
    reviewerUserId: null,
    assignmentType: "SELF_MANAGED",
    organizationId: 7,
    startedAt: null,
    ...overrides,
  };
}

function actor(
  overrides: Record<string, unknown> = {},
) {
  return {
    userId: "user-authenticated",
    organizationId: 7,
    vendorId: null,
    role: "ADMIN",
    ...overrides,
  };
}

describe("review assignment claim authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.auth.mockResolvedValue({
      userId: "user-authenticated",
    });

    mocks.currentUser.mockResolvedValue({
      fullName: "Authenticated Reviewer",
      firstName: "Authenticated",
      lastName: "Reviewer",
      primaryEmailAddress: {
        emailAddress: "reviewer@example.test",
      },
    });

    mocks.requireReviewerAccess.mockResolvedValue(
      actor(),
    );

    mocks.isTruvernOperator.mockResolvedValue(true);
    mocks.queryRaw.mockResolvedValue([assignment()]);
    mocks.executeRaw.mockResolvedValue(1);

    mocks.governanceAuthErrorResponse.mockImplementation(
      (error: any) => {
        if (error?.status === 401 || error?.status === 403) {
          return Response.json(
            {
              ok: false,
              error: error.message,
            },
            { status: error.status },
          );
        }

        return null;
      },
    );
  });

  it("returns 401 when unauthenticated without reading or mutating", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(401);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("returns 404 before reviewer authorization when assignment is missing", async () => {
    mocks.queryRaw.mockResolvedValue([]);

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(404);
    expect(mocks.requireReviewerAccess).not.toHaveBeenCalled();
    expect(mocks.isTruvernOperator).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("preserves operator-only authorization for Truvern assignments", async () => {
    mocks.queryRaw.mockResolvedValue([
      assignment({ assignmentType: "TRUVERN" }),
    ]);
    mocks.isTruvernOperator.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(403);
    expect(mocks.isTruvernOperator).toHaveBeenCalledTimes(1);
    expect(mocks.requireReviewerAccess).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("allows an authorized Truvern operator without broad reviewer authorization", async () => {
    mocks.queryRaw.mockResolvedValue([
      assignment({ assignmentType: "TRUVERN" }),
    ]);

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(200);
    expect(mocks.isTruvernOperator).toHaveBeenCalledTimes(1);
    expect(mocks.requireReviewerAccess).not.toHaveBeenCalled();
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
  });

  it("allows same-organization customer reviewer", async () => {
    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(200);
    expect(mocks.requireReviewerAccess).toHaveBeenCalledTimes(1);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
  });

  it("denies cross-organization customer reviewer without mutation", async () => {
    mocks.requireReviewerAccess.mockResolvedValue(
      actor({ organizationId: 99 }),
    );

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(403);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("denies Truvern reviewer from customer assignment", async () => {
    mocks.requireReviewerAccess.mockResolvedValue(
      actor({
        role: "TRUVERN_REVIEWER",
        organizationId: null,
      }),
    );

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(403);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("allows OPS across organization boundaries", async () => {
    mocks.requireReviewerAccess.mockResolvedValue(
      actor({
        role: "OPS",
        organizationId: null,
      }),
    );

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(200);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
  });

  it("maps governance denial to 403 rather than 500", async () => {
    const denied = Object.assign(
      new Error("Reviewer access denied."),
      { status: 403 },
    );

    mocks.requireReviewerAccess.mockRejectedValue(denied);

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(403);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("returns 409 when assignment is already owned by another reviewer", async () => {
    mocks.queryRaw.mockResolvedValue([
      assignment({ reviewerUserId: "another-user" }),
    ]);

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(409);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("returns 409 when the atomic claim loses the race", async () => {
    mocks.executeRaw.mockResolvedValue(0);

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(409);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
  });

  it("allows idempotent same-user retry", async () => {
    mocks.queryRaw.mockResolvedValue([
      assignment({ reviewerUserId: "user-authenticated" }),
    ]);

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context("41"),
    );

    expect(response.status).toBe(200);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
  });
});
