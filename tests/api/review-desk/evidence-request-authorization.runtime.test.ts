import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess: vi.fn(),
  requireReviewAssignmentAccess: vi.fn(),
  governanceAuthErrorResponse: vi.fn(),
  governanceForbidden: vi.fn(),
  findVendor: vi.fn(),
  insertEvidenceRequest: vi.fn(),
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess:
    mocks.requireReviewerAccess,
  requireReviewAssignmentAccess:
    mocks.requireReviewAssignmentAccess,
}));

vi.mock("@/lib/auth/governance-auth-errors", () => ({
  governanceAuthErrorResponse:
    mocks.governanceAuthErrorResponse,
  governanceForbidden:
    mocks.governanceForbidden,
}));

vi.mock("@/lib/repositories/vendor-repository", () => ({
  findVendor:
    mocks.findVendor,
}));

vi.mock("@/lib/repositories/evidence-request-write-repository", () => ({
  insertEvidenceRequest:
    mocks.insertEvidenceRequest,
}));

import { POST } from "../../../app/api/evidence-requests/route";

type ActorRole =
  | "OPS"
  | "TRUVERN_REVIEWER"
  | "OWNER"
  | "ADMIN"
  | "ANALYST";

function actor(
  overrides: Partial<{
    userId: string;
    role: ActorRole;
    organizationId: number | null;
  }> = {},
) {
  return {
    userId: "user-1",
    role: "ANALYST" as ActorRole,
    organizationId: 10,
    ...overrides,
  };
}

function assignment(
  overrides: Partial<{
    id: number;
    organizationId: number;
    vendorId: number;
    status: string;
    assignmentType: string;
    reviewerUserId: string | null;
  }> = {},
) {
  return {
    id: 44,
    organizationId: 10,
    vendorId: 20,
    status: "IN_PROGRESS",
    assignmentType: "TRUVERN",
    reviewerUserId: "reviewer-1",
    ...overrides,
  };
}

function request(
  body: Record<string, unknown>,
) {
  return new Request(
    "http://localhost/api/evidence-requests",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

async function readBody(
  response: Response,
) {
  return await response.json() as Record<string, unknown>;
}

function mapAuthFailure(
  error: Error,
  status: number,
  message: string,
) {
  mocks.governanceAuthErrorResponse
    .mockImplementation((candidate: unknown) =>
      candidate === error
        ? Response.json(
            {
              ok: false,
              error: message,
            },
            { status },
          )
        : null,
    );
}

describe("evidence request authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireReviewerAccess.mockResolvedValue(
      actor(),
    );

    mocks.requireReviewAssignmentAccess.mockResolvedValue({
      actor: actor({
        userId: "reviewer-1",
        role: "TRUVERN_REVIEWER",
        organizationId: null,
      }),
      assignment: assignment(),
    });

    mocks.findVendor.mockResolvedValue({
      id: 20,
      organizationId: 10,
    });

    mocks.insertEvidenceRequest.mockResolvedValue([
      { id: 501 },
    ]);

    mocks.governanceAuthErrorResponse
      .mockReturnValue(null);

    mocks.governanceForbidden
      .mockImplementation((message: string) => {
        const error = new Error(message);
        Object.assign(error, {
          code: "FORBIDDEN",
        });
        return error;
      });
  });

  it("returns 400 for an invalid vendor id before authorization or mutation", async () => {
    const response = await POST(
      request({
        vendorId: 0,
        kind: "SOC2",
      }),
    );

    expect(response.status).toBe(400);

    expect(
      mocks.requireReviewerAccess,
    ).not.toHaveBeenCalled();

    expect(
      mocks.requireReviewAssignmentAccess,
    ).not.toHaveBeenCalled();

    expect(
      mocks.findVendor,
    ).not.toHaveBeenCalled();

    expect(
      mocks.insertEvidenceRequest,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid supplied assignment id before authorization or mutation", async () => {
    const response = await POST(
      request({
        vendorId: 20,
        reviewAssignmentId: "nope",
        kind: "SOC2",
      }),
    );

    expect(response.status).toBe(400);

    expect(
      mocks.requireReviewerAccess,
    ).not.toHaveBeenCalled();

    expect(
      mocks.requireReviewAssignmentAccess,
    ).not.toHaveBeenCalled();

    expect(
      mocks.findVendor,
    ).not.toHaveBeenCalled();

    expect(
      mocks.insertEvidenceRequest,
    ).not.toHaveBeenCalled();
  });

  it("maps assignment authorization failure before evidence mutation", async () => {
    const denial =
      new Error("assignment forbidden");

    mocks.requireReviewAssignmentAccess
      .mockRejectedValue(denial);

    mapAuthFailure(
      denial,
      403,
      "Forbidden",
    );

    const response = await POST(
      request({
        vendorId: 20,
        reviewAssignmentId: 44,
        kind: "SOC2",
      }),
    );

    expect(response.status).toBe(403);

    expect(
      mocks.requireReviewAssignmentAccess,
    ).toHaveBeenCalledWith(44);

    expect(
      mocks.requireReviewerAccess,
    ).not.toHaveBeenCalled();

    expect(
      mocks.findVendor,
    ).not.toHaveBeenCalled();

    expect(
      mocks.insertEvidenceRequest,
    ).not.toHaveBeenCalled();
  });

  it("denies a vendor that does not match the authorized assignment", async () => {
    const denial =
      new Error("vendor mismatch");

    mocks.governanceForbidden
      .mockReturnValue(denial);

    mapAuthFailure(
      denial,
      403,
      "Vendor does not match this review assignment.",
    );

    const response = await POST(
      request({
        vendorId: 99,
        reviewAssignmentId: 44,
        kind: "SOC2",
      }),
    );

    expect(response.status).toBe(403);

    expect(
      mocks.requireReviewAssignmentAccess,
    ).toHaveBeenCalledWith(44);

    expect(
      mocks.governanceForbidden,
    ).toHaveBeenCalledWith(
      "Vendor does not match this review assignment.",
    );

    expect(
      mocks.findVendor,
    ).not.toHaveBeenCalled();

    expect(
      mocks.insertEvidenceRequest,
    ).not.toHaveBeenCalled();
  });

  it("uses canonical assignment scope and actor identity for assignment requests", async () => {
    mocks.requireReviewAssignmentAccess
      .mockResolvedValue({
        actor: actor({
          userId: "truvern-reviewer-7",
          role: "TRUVERN_REVIEWER",
          organizationId: null,
        }),
        assignment: assignment({
          id: 44,
          vendorId: 20,
          organizationId: 77,
        }),
      });

    const response = await POST(
      request({
        vendorId: 20,
        organizationId: 999,
        reviewAssignmentId: 44,
        kind: "SOC2",
        label: "SOC 2 Type II",
        dueAt: "2026-10-15T00:00:00.000Z",
      }),
    );

    expect(response.status).toBe(200);

    expect(
      mocks.requireReviewAssignmentAccess,
    ).toHaveBeenCalledWith(44);

    expect(
      mocks.requireReviewerAccess,
    ).not.toHaveBeenCalled();

    expect(
      mocks.findVendor,
    ).not.toHaveBeenCalled();

    expect(
      mocks.insertEvidenceRequest,
    ).toHaveBeenCalledTimes(1);

    const input =
      mocks.insertEvidenceRequest.mock.calls[0][0];

    expect(input).toMatchObject({
      vendorId: 20,
      organizationId: 77,
      requestedBy: "truvern-reviewer-7",
      kind: "SOC2",
      title: "SOC 2 Type II",
    });

    expect(input.dueAt).toBeInstanceOf(Date);

    const body =
      await readBody(response);

    expect(body).toMatchObject({
      ok: true,
      id: 501,
      vendorId: 20,
      organizationId: 77,
      reviewAssignmentId: 44,
    });
  });

  it("allows a same-organization reviewer through the general path using server-resolved vendor scope", async () => {
    mocks.requireReviewerAccess.mockResolvedValue(
      actor({
        userId: "analyst-10",
        role: "ANALYST",
        organizationId: 10,
      }),
    );

    const response = await POST(
      request({
        vendorId: 20,
        organizationId: 999,
        kind: "POLICY",
        title: "Security policy",
      }),
    );

    expect(response.status).toBe(200);

    expect(
      mocks.requireReviewerAccess,
    ).toHaveBeenCalledTimes(1);

    expect(
      mocks.requireReviewAssignmentAccess,
    ).not.toHaveBeenCalled();

    expect(
      mocks.findVendor,
    ).toHaveBeenCalledWith({
      where: {
        id: 20,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    expect(
      mocks.insertEvidenceRequest,
    ).toHaveBeenCalledWith({
      vendorId: 20,
      organizationId: 10,
      requestedBy: "analyst-10",
      kind: "POLICY",
      title: "Security policy",
      dueAt: null,
    });
  });

  it("denies a general-path reviewer from another organization", async () => {
    mocks.requireReviewerAccess.mockResolvedValue(
      actor({
        userId: "analyst-99",
        role: "ANALYST",
        organizationId: 99,
      }),
    );

    const denial =
      new Error("cross organization");

    mocks.governanceForbidden
      .mockReturnValue(denial);

    mapAuthFailure(
      denial,
      403,
      "You do not have access to this vendor.",
    );

    const response = await POST(
      request({
        vendorId: 20,
        organizationId: 99,
        kind: "SOC2",
      }),
    );

    expect(response.status).toBe(403);

    expect(
      mocks.governanceForbidden,
    ).toHaveBeenCalledWith(
      "You do not have access to this vendor.",
    );

    expect(
      mocks.insertEvidenceRequest,
    ).not.toHaveBeenCalled();
  });

  it("allows OPS through the general path across organizations", async () => {
    mocks.requireReviewerAccess.mockResolvedValue(
      actor({
        userId: "ops-1",
        role: "OPS",
        organizationId: 999,
      }),
    );

    const response = await POST(
      request({
        vendorId: 20,
        organizationId: 999,
        kind: "ISO27001",
      }),
    );

    expect(response.status).toBe(200);

    expect(
      mocks.governanceForbidden,
    ).not.toHaveBeenCalled();

    expect(
      mocks.insertEvidenceRequest,
    ).toHaveBeenCalledWith({
      vendorId: 20,
      organizationId: 10,
      requestedBy: "ops-1",
      kind: "ISO27001",
      title: "Evidence request",
      dueAt: null,
    });
  });

  it("denies an unscoped Truvern reviewer on the general path", async () => {
    mocks.requireReviewerAccess.mockResolvedValue(
      actor({
        userId: "truvern-reviewer-7",
        role: "TRUVERN_REVIEWER",
        organizationId: null,
      }),
    );

    const denial =
      new Error("assignment required");

    mocks.governanceForbidden
      .mockReturnValue(denial);

    mapAuthFailure(
      denial,
      403,
      "Truvern reviewers must create evidence requests from an authorized review assignment.",
    );

    const response = await POST(
      request({
        vendorId: 20,
        kind: "SOC2",
      }),
    );

    expect(response.status).toBe(403);

    expect(
      mocks.requireReviewerAccess,
    ).toHaveBeenCalledTimes(1);

    expect(
      mocks.findVendor,
    ).toHaveBeenCalledTimes(1);

    expect(
      mocks.governanceForbidden,
    ).toHaveBeenCalledWith(
      "Truvern reviewers must create evidence requests from an authorized review assignment.",
    );

    expect(
      mocks.insertEvidenceRequest,
    ).not.toHaveBeenCalled();
  });

  it("maps general reviewer authorization failure before vendor lookup or mutation", async () => {
    const denial =
      new Error("unauthorized");

    mocks.requireReviewerAccess
      .mockRejectedValue(denial);

    mapAuthFailure(
      denial,
      401,
      "Unauthorized",
    );

    const response = await POST(
      request({
        vendorId: 20,
        kind: "SOC2",
      }),
    );

    expect(response.status).toBe(401);

    expect(
      mocks.governanceAuthErrorResponse,
    ).toHaveBeenCalledWith(denial);

    expect(
      mocks.findVendor,
    ).not.toHaveBeenCalled();

    expect(
      mocks.insertEvidenceRequest,
    ).not.toHaveBeenCalled();
  });

  it("returns 404 when the general-path vendor does not exist", async () => {
    mocks.findVendor.mockResolvedValue(null);

    const response = await POST(
      request({
        vendorId: 404,
        kind: "OTHER",
      }),
    );

    expect(response.status).toBe(404);

    expect(
      await readBody(response),
    ).toMatchObject({
      ok: false,
      error: "Vendor not found.",
    });

    expect(
      mocks.insertEvidenceRequest,
    ).not.toHaveBeenCalled();
  });

  it("preserves non-governance write failures as server errors", async () => {
    mocks.insertEvidenceRequest
      .mockRejectedValue(
        new Error("write failed"),
      );

    const response = await POST(
      request({
        vendorId: 20,
        kind: "OTHER",
      }),
    );

    expect(response.status).toBe(500);

    expect(
      await readBody(response),
    ).toMatchObject({
      ok: false,
      error: "write failed",
    });
  });
});