import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess: vi.fn(),
  requireGovernanceCapability: vi.fn(),
  requireFrameworkAssessmentAccess: vi.fn(),

  countTruvernAssessmentFindings: vi.fn(),
  countTruvernRemediationRequests: vi.fn(),
  countTruvernAssessmentAttestations: vi.fn(),

  updateTruvernFrameworkAssessment: vi.fn(),
  writeGovernanceAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {},
}));

vi.mock("@/lib/auth/governance-auth-errors", () => ({
  governanceAuthErrorResponse: vi.fn(() => null),
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
  requireGovernanceCapability: mocks.requireGovernanceCapability,
  requireFrameworkAssessmentAccess:
    mocks.requireFrameworkAssessmentAccess,
}));

vi.mock(
  "@/lib/repositories/truvern-framework-assessment-repository",
  () => ({
    updateTruvernFrameworkAssessment:
      mocks.updateTruvernFrameworkAssessment,
  }),
);

vi.mock(
  "@/lib/repositories/truvern-assessment-finding-repository",
  () => ({
    countTruvernAssessmentFindings:
      mocks.countTruvernAssessmentFindings,
  }),
);

vi.mock(
  "@/lib/repositories/truvern-remediation-request-repository",
  () => ({
    countTruvernRemediationRequests:
      mocks.countTruvernRemediationRequests,
  }),
);

vi.mock(
  "@/lib/repositories/truvern-assessment-attestation-repository",
  () => ({
    countTruvernAssessmentAttestations:
      mocks.countTruvernAssessmentAttestations,
  }),
);

vi.mock("@/lib/governance/audit-log", () => ({
  writeGovernanceAuditLog: mocks.writeGovernanceAuditLog,
}));

import { POST } from "@/app/api/truvern/framework-assessments/[id]/release-ready/route";

function context(id = "5") {
  return {
    params: Promise.resolve({ id }),
  };
}

describe("framework assessment release-ready guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "reviewer-1",
    });

    mocks.requireFrameworkAssessmentAccess.mockResolvedValue(undefined);

    mocks.countTruvernAssessmentFindings.mockResolvedValue(0);
    mocks.countTruvernRemediationRequests.mockResolvedValue(0);
    mocks.countTruvernAssessmentAttestations.mockResolvedValue(0);

    mocks.writeGovernanceAuditLog.mockResolvedValue(undefined);
  });

  it("rejects unresolved blockers without readiness mutation or audit", async () => {
    mocks.countTruvernAssessmentFindings.mockResolvedValue(1);
    mocks.countTruvernRemediationRequests.mockResolvedValue(2);
    mocks.countTruvernAssessmentAttestations.mockResolvedValue(3);

    const response = await POST(
      new Request(
        "http://localhost/api/truvern/framework-assessments/5/release-ready",
        { method: "POST" },
      ),
      context(),
    );

    expect(response.status).toBe(409);

    const body = await response.json();

    expect(body).toMatchObject({
      ok: false,
      unresolved: {
        findings: 1,
        remediation: 2,
        attestations: 3,
      },
    });

    expect(
      mocks.updateTruvernFrameworkAssessment,
    ).not.toHaveBeenCalled();

    expect(
      mocks.writeGovernanceAuditLog,
    ).not.toHaveBeenCalled();
  });

  it("marks an unblocked assessment READY_FOR_RELEASE and audits exactly once", async () => {
    mocks.updateTruvernFrameworkAssessment.mockImplementation(
      async (args: {
        where: { id: number };
        data: {
          status: string;
          readyForReleaseAt: Date;
        };
      }) => ({
        id: args.where.id,
        organizationId: 9,
        status: args.data.status,
        readyForReleaseAt: args.data.readyForReleaseAt,
      }),
    );

    const response = await POST(
      new Request(
        "http://localhost/api/truvern/framework-assessments/5/release-ready",
        { method: "POST" },
      ),
      context(),
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.assessment).toMatchObject({
      id: 5,
      organizationId: 9,
      status: "READY_FOR_RELEASE",
    });

    expect(
      mocks.updateTruvernFrameworkAssessment,
    ).toHaveBeenCalledTimes(1);

    const updateCall =
      mocks.updateTruvernFrameworkAssessment.mock.calls[0][0];

    expect(updateCall.where).toEqual({
      id: 5,
    });

    expect(updateCall.data.status).toBe(
      "READY_FOR_RELEASE",
    );

    expect(
      updateCall.data.readyForReleaseAt,
    ).toBeInstanceOf(Date);

    expect(
      mocks.writeGovernanceAuditLog,
    ).toHaveBeenCalledTimes(1);

    const auditCall =
      mocks.writeGovernanceAuditLog.mock.calls[0][0];

    expect(auditCall).toMatchObject({
      organizationId: 9,
      entityType: "TruvernFrameworkAssessment",
      entityId: 5,
      action: "FRAMEWORK_RELEASE_READY",
      message:
        "Framework assessment was marked release-ready.",
    });

    expect(
      auditCall.metadata.readyForReleaseAt,
    ).toBeInstanceOf(Date);
  });
});