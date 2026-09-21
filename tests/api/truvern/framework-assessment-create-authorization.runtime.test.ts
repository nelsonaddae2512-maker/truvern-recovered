import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  requireReviewerAccess: vi.fn(),
  requireReviewAssignmentAccess: vi.fn(),
  governanceAuthErrorResponse: vi.fn(),
  governanceForbidden: vi.fn(),
  findTruvernFramework: vi.fn(),
  createTruvernFrameworkAssessment: vi.fn(),
  requireTruvernFrameworkAssessment: vi.fn(),
  createTruvernAssessmentResponses: vi.fn(),
  findFirstAssessmentRun: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: mocks.currentUser,
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
  requireReviewAssignmentAccess:
    mocks.requireReviewAssignmentAccess,
}));

vi.mock("@/lib/auth/governance-auth-errors", () => ({
  governanceAuthErrorResponse:
    mocks.governanceAuthErrorResponse,
  governanceForbidden: mocks.governanceForbidden,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/repositories/truvern-framework-repository", () => ({
  findTruvernFramework: mocks.findTruvernFramework,
}));

vi.mock(
  "@/lib/repositories/truvern-framework-assessment-repository",
  () => ({
    createTruvernFrameworkAssessment:
      mocks.createTruvernFrameworkAssessment,
    requireTruvernFrameworkAssessment:
      mocks.requireTruvernFrameworkAssessment,
  }),
);

vi.mock(
  "@/lib/repositories/truvern-assessment-response-repository",
  () => ({
    createTruvernAssessmentResponses:
      mocks.createTruvernAssessmentResponses,
  }),
);

vi.mock("@/lib/repositories/assessment-run-repository", () => ({
  findFirstAssessmentRun: mocks.findFirstAssessmentRun,
}));

import { POST } from "@/app/api/truvern/framework-assessments/route";

function request(body: Record<string, unknown>) {
  return new Request(
    "http://localhost/api/truvern/framework-assessments",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

function forbidden(message: string) {
  const error = new Error(message);

  Object.assign(error, {
    status: 403,
    code: "FORBIDDEN",
  });

  return error;
}

describe("framework assessment create authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.currentUser.mockResolvedValue({
      id: "user-1",
      fullName: "Reviewer One",
      firstName: "Reviewer",
      lastName: "One",
      primaryEmailAddress: {
        emailAddress: "reviewer@example.test",
      },
    });

    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "user-1",
      organizationId: 10,
      vendorId: null,
      role: "ADMIN",
    });

    mocks.requireReviewAssignmentAccess.mockResolvedValue({
      assignment: {
        id: 41,
        organizationId: 10,
        vendorId: 20,
        status: "PENDING",
        assignmentType: "SELF_MANAGED",
        reviewerUserId: null,
      },
    });

    mocks.findTruvernFramework.mockResolvedValue({
      id: 5,
      name: "NIST 800-53",
      slug: "nist-800-53",
    });

    mocks.findFirstAssessmentRun.mockResolvedValue({
      id: 7,
      organizationId: 10,
      vendorId: 20,
    });

    mocks.governanceForbidden.mockImplementation(
      (message: string) => forbidden(message),
    );

    mocks.governanceAuthErrorResponse.mockImplementation(
      (error: any) => {
        if (error?.status === 401 || error?.status === 403) {
          return Response.json(
            {
              ok: false,
              error: error.message,
            },
            {
              status: error.status,
            },
          );
        }

        return null;
      },
    );

    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        await callback({}),
    );

    mocks.createTruvernFrameworkAssessment.mockResolvedValue({
      id: 101,
    });

    mocks.requireTruvernFrameworkAssessment.mockResolvedValue({
      id: 101,
      frameworkId: 5,
      organizationId: 10,
      vendorId: 20,
      assessmentRunId: null,
      reviewAssignmentId: 41,
      title: "NIST 800-53 — Vendor 20",
      status: "DRAFT",
      framework: {
        id: 5,
        name: "NIST 800-53",
        slug: "nist-800-53",
      },
      responses: [],
    });

    mocks.createTruvernAssessmentResponses.mockResolvedValue({
      count: 0,
    });
  });

  it("rejects an organization that conflicts with the authorized assignment", async () => {
    const response = await POST(
      request({
        frameworkId: 5,
        reviewAssignmentId: 41,
        organizationId: 99,
        vendorId: 20,
      }),
    );

    expect(response.status).toBe(403);

    expect(
      mocks.requireReviewAssignmentAccess,
    ).toHaveBeenCalledWith(41);

    expect(mocks.governanceForbidden).toHaveBeenCalledWith(
      "Requested organization does not match the review assignment.",
    );

    expect(
      mocks.createTruvernFrameworkAssessment,
    ).not.toHaveBeenCalled();

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a vendor that conflicts with the authorized assignment", async () => {
    const response = await POST(
      request({
        frameworkId: 5,
        reviewAssignmentId: 41,
        organizationId: 10,
        vendorId: 99,
      }),
    );

    expect(response.status).toBe(403);

    expect(
      mocks.requireReviewAssignmentAccess,
    ).toHaveBeenCalledWith(41);

    expect(mocks.governanceForbidden).toHaveBeenCalledWith(
      "Requested vendor does not match the review assignment.",
    );

    expect(
      mocks.createTruvernFrameworkAssessment,
    ).not.toHaveBeenCalled();

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an assessment run from another organization", async () => {
    mocks.findFirstAssessmentRun.mockResolvedValue({
      id: 7,
      organizationId: 99,
      vendorId: 20,
    });

    const response = await POST(
      request({
        frameworkId: 5,
        reviewAssignmentId: 41,
        assessmentRunId: 7,
      }),
    );

    expect(response.status).toBe(403);

    expect(mocks.findFirstAssessmentRun).toHaveBeenCalledWith({
      where: {
        id: 7,
      },
      select: {
        id: true,
        organizationId: true,
        vendorId: true,
      },
    });

    expect(mocks.governanceForbidden).toHaveBeenCalledWith(
      "Assessment run organization does not match the framework assessment.",
    );

    expect(
      mocks.createTruvernFrameworkAssessment,
    ).not.toHaveBeenCalled();

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an assessment run for another vendor", async () => {
    mocks.findFirstAssessmentRun.mockResolvedValue({
      id: 7,
      organizationId: 10,
      vendorId: 99,
    });

    const response = await POST(
      request({
        frameworkId: 5,
        reviewAssignmentId: 41,
        assessmentRunId: 7,
      }),
    );

    expect(response.status).toBe(403);

    expect(mocks.governanceForbidden).toHaveBeenCalledWith(
      "Assessment run vendor does not match the framework assessment.",
    );

    expect(
      mocks.createTruvernFrameworkAssessment,
    ).not.toHaveBeenCalled();

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
