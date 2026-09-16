import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRouteContext,
  readJsonResponse,
} from "@/tests/support/http";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess:
    vi.fn<(...args: unknown[]) => Promise<any>>(),
  findReviewAssignment:
    vi.fn<(...args: unknown[]) => Promise<any>>(),
  updateReviewAssignment:
    vi.fn<(...args: unknown[]) => Promise<any>>(),
  findReviewRequest:
    vi.fn<(...args: unknown[]) => Promise<any>>(),
  findVendor:
    vi.fn<(...args: unknown[]) => Promise<any>>(),
  findAssessmentAnswers:
    vi.fn<(...args: unknown[]) => Promise<any[]>>(),
  findLatestReviewResponse:
    vi.fn<(...args: unknown[]) => Promise<any>>(),
  updateReviewResponse:
    vi.fn<(...args: unknown[]) => Promise<any>>(),
  createReviewResponse:
    vi.fn<(...args: unknown[]) => Promise<any>>(),
  resolveOrganizationPlanTier:
    vi.fn<(...args: unknown[]) => Promise<any>>(),
  isTruvernOperator:
    vi.fn<(...args: unknown[]) => Promise<boolean>>(),
  transaction:
    vi.fn<(...args: any[]) => Promise<any>>(),
  runGovernanceIntelligence:
    vi.fn<(...args: unknown[]) => any>(),
  deriveCanonicalGovernanceOutcome:
    vi.fn<(...args: unknown[]) => any>(),
  buildCanonicalGovernanceArtifact:
    vi.fn<(...args: unknown[]) => any>(),
  findTruvernFrameworkAssessments:
    vi.fn<(...args: unknown[]) => Promise<any[]>>(),
  normalizeFrameworkAssessmentFindingsInput:
    vi.fn<(...args: unknown[]) => any[]>(),
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/repositories/review-assignment-repository", () => ({
  findReviewAssignment: mocks.findReviewAssignment,
  updateReviewAssignment: mocks.updateReviewAssignment,
}));

vi.mock("@/lib/repositories/review-request-repository", () => ({
  findReviewRequest: mocks.findReviewRequest,
}));

vi.mock("@/lib/repositories/vendor-repository", () => ({
  findVendor: mocks.findVendor,
}));

vi.mock("@/lib/repositories/assessment-answer-repository", () => ({
  findAssessmentAnswers: mocks.findAssessmentAnswers,
}));

vi.mock("@/lib/repositories/review-response-repository", () => ({
  findLatestReviewResponse: mocks.findLatestReviewResponse,
  updateReviewResponse: mocks.updateReviewResponse,
  createReviewResponse: mocks.createReviewResponse,
}));

vi.mock("@/lib/billing/organization-plan", () => ({
  resolveOrganizationPlanTier:
    mocks.resolveOrganizationPlanTier,
}));

vi.mock("@/lib/truvern-ops-access", () => ({
  isTruvernOperator: mocks.isTruvernOperator,
}));

vi.mock(
  "@/lib/governance/intelligence/governance-intelligence-engine",
  () => ({
    runGovernanceIntelligence:
      mocks.runGovernanceIntelligence,
    deriveCanonicalGovernanceOutcome:
      mocks.deriveCanonicalGovernanceOutcome,
  }),
);

vi.mock(
  "@/lib/governance/canonical-governance-artifact",
  () => ({
    buildCanonicalGovernanceArtifact:
      mocks.buildCanonicalGovernanceArtifact,
  }),
);

vi.mock(
  "@/lib/repositories/truvern-framework-assessment-repository",
  () => ({
    findTruvernFrameworkAssessments:
      mocks.findTruvernFrameworkAssessments,
  }),
);

vi.mock(
  "@/lib/governance/framework-assessment-findings-input",
  () => ({
    normalizeFrameworkAssessmentFindingsInput:
      mocks.normalizeFrameworkAssessmentFindingsInput,
  }),
);

import { POST } from "@/app/api/review-desk/reviews/[id]/generate-findings/route";

function request() {
  return new Request(
    "http://localhost/api/review-desk/reviews/42/generate-findings",
    { method: "POST" },
  );
}

function intelligence() {
  return {
    assessmentId: 42,
    vendorName: "Acme Vendor",
    frameworkName: "Truvern Governance Review",
    score: {
      percent: 48,
      riskLevel: "HIGH",
    },
    findings: [
      {
        title: "Missing evidence",
        severity: "HIGH",
        remediationRequired: true,
        evidenceRequired: true,
        attestationRequired: false,
      },
    ],
    remediationRequired: true,
    attestationRequired: false,
    recommendation: "HIGH_RISK",
    executiveSummary: "Response-driven executive summary",
    finalRecommendation: "Escalate for risk-owner review.",
    followUps: ["Evidence required: Missing evidence"],
    metrics: {
      totalResponses: 2,
      completedQuestions: 2,
      missingEvidence: 1,
      criticalFindings: 0,
      highFindings: 1,
      moderateFindings: 0,
    },
  };
}

function assignment() {
  return {
    id: 42,
    organizationId: 7,
    vendorId: 11,
    reviewRequestId: null,
    assignmentType: "TRUVERN",
  };
}

function legacyResponse(responses: Record<string, any>) {
  return {
    id: 101,
    responses,
    draftSavedAt: null,
    submittedAt: null,
    updatedAt: new Date("2026-07-24T18:30:00.000Z"),
  };
}

describe("POST generate-findings", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireReviewerAccess.mockResolvedValue({
      role: "OPS",
      organizationId: 7,
    });

    mocks.findReviewAssignment.mockResolvedValue(
      assignment(),
    );

    mocks.findReviewRequest.mockResolvedValue(null);

    mocks.findVendor.mockResolvedValue({
      name: "Acme Vendor",
    });

    mocks.findAssessmentAnswers.mockResolvedValue([]);

    mocks.findLatestReviewResponse.mockResolvedValue(
      legacyResponse({}),
    );

    mocks.findTruvernFrameworkAssessments.mockResolvedValue([]);

    mocks.normalizeFrameworkAssessmentFindingsInput.mockReturnValue([]);

    mocks.resolveOrganizationPlanTier.mockResolvedValue("PRO");

    mocks.isTruvernOperator.mockResolvedValue(true);

    mocks.transaction.mockImplementation(
      async (callback: (tx: any) => Promise<any>) =>
        callback({}),
    );

    mocks.updateReviewResponse.mockResolvedValue({});
    mocks.createReviewResponse.mockResolvedValue({});
    mocks.updateReviewAssignment.mockResolvedValue({});

    mocks.runGovernanceIntelligence.mockReturnValue(
      intelligence(),
    );

    mocks.deriveCanonicalGovernanceOutcome.mockReturnValue({
      riskLevel: "HIGH",
      recommendation: "HIGH_RISK",
      remediationRequired: true,
      attestationRequired: false,
      followUps: [
        "Continue periodic governance monitoring.",
      ],
    });

    mocks.buildCanonicalGovernanceArtifact.mockReturnValue({
      schema: "truvern.canonical_governance_artifact.v1",
      generatedAt: "2026-07-24T18:30:00.000Z",
      executiveSummary: "Response-driven executive summary",
      finalAssessment: "Escalate for risk-owner review.",
      finalRecommendation: "Escalate for risk-owner review.",
      decision: "HIGH_RISK",
      riskLevel: "HIGH",
      findings: intelligence().findings,
      conditionsAndFollowUps: [
        "Continue periodic governance monitoring.",
        "Maintain evidence and operational control documentation.",
        "Notify customers of material operational or security changes when applicable.",
      ],
      boardSummary: "Response-driven executive summary",
      customerSummary: "Escalate for risk-owner review.",
    });
  });

  it.each(["", "0", "-1", "abc"])(
    "rejects invalid assignment id %j",
    async (id) => {
      const response = await POST(
        request(),
        createRouteContext({ id }),
      );

      expect(response.status).toBe(400);
      expect(await readJsonResponse(response)).toEqual({
        ok: false,
        error: "Review assignment id required.",
      });
      expect(
        mocks.findReviewAssignment,
      ).not.toHaveBeenCalled();
    },
  );

  it("returns 404 when the assignment does not exist", async () => {
    mocks.findReviewAssignment.mockResolvedValue(null);

    const response = await POST(
      request(),
      createRouteContext({ id: "42" }),
    );

    expect(response.status).toBe(404);
    expect(await readJsonResponse(response)).toEqual({
      ok: false,
      error: "Review assignment not found.",
    });
  });

  it("rejects an assignment without questionnaire responses", async () => {
    mocks.findLatestReviewResponse.mockResolvedValue(
      legacyResponse({}),
    );

    const response = await POST(
      request(),
      createRouteContext({ id: "42" }),
    );

    expect(response.status).toBe(400);
    expect(await readJsonResponse(response)).toEqual({
      ok: false,
      error:
        "No questionnaire responses found for intelligence generation.",
    });

    expect(
      mocks.runGovernanceIntelligence,
    ).not.toHaveBeenCalled();
  });

  it("converts submitted answers into response-driven scoring input", async () => {
    mocks.findLatestReviewResponse.mockResolvedValue(
      legacyResponse({
        submittedAnswers: [
          {
            questionId: 1,
            controlCode: "AC-1",
            family: "Access Control",
            questionText: "Is access formally governed?",
            answer: "partial",
            requiresEvidence: true,
            evidenceFiles: [],
          },
          {
            assessmentQuestion: {
              id: 2,
              controlCode: "IR-1",
              category: "Incident Response",
              prompt: "Is the IR plan tested?",
              requiresAttestation: true,
              weight: 3,
            },
            response: "no",
          },
        ],
      }),
    );

    const response = await POST(
      request(),
      createRouteContext({ id: "42" }),
    );

    expect(response.status).toBe(200);

    expect(
      mocks.runGovernanceIntelligence,
    ).toHaveBeenCalledWith({
      assessmentId: 42,
      vendorName: "Acme Vendor",
      frameworkName: "Truvern Governance Review",
      responses: [
        expect.objectContaining({
          questionId: 1,
          controlCode: "AC-1",
          family: "Access Control",
          prompt: "Is access formally governed?",
          answer: "partial",
          requiresEvidence: true,
          evidence: [],
        }),
        expect.objectContaining({
          questionId: 2,
          controlCode: "IR-1",
          family: "Incident Response",
          prompt: "Is the IR plan tested?",
          answer: "no",
          weight: 3,
          requiresAttestation: true,
        }),
      ],
    });
  });

  it("uses linked framework assessment responses when ordinary assessment answers are absent", async () => {
    const frameworkResponses = [
      {
        id: 901,
        assessmentId: 301,
        questionId: 501,
        answer: "partial",
        evidence: [],
        question: {
          id: 501,
          prompt: "Is privileged access governed?",
          weight: 2,
          requiresEvidence: true,
          requiresAttestation: false,
          metadata: null,
          control: {
            id: 601,
            controlId: "AC-6",
            family: "Access Control",
          },
        },
      },
    ];

    const normalizedFrameworkResponses = [
      {
        questionId: 501,
        controlId: 601,
        controlCode: "AC-6",
        family: "Access Control",
        prompt: "Is privileged access governed?",
        answer: "partial",
        weight: 2,
        maxScore: 2,
        requiresEvidence: true,
        requiresAttestation: false,
        evidence: [],
      },
    ];

    mocks.findTruvernFrameworkAssessments.mockResolvedValue([
      {
        id: 301,
        reviewAssignmentId: 42,
        status: "SUBMITTED",
        responses: frameworkResponses,
      },
    ]);

    mocks.normalizeFrameworkAssessmentFindingsInput.mockReturnValue(
      normalizedFrameworkResponses,
    );

    const response = await POST(
      request(),
      createRouteContext({ id: "42" }),
    );

    expect(response.status).toBe(200);

    expect(
      mocks.findTruvernFrameworkAssessments,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reviewAssignmentId: 42,
          status: "SUBMITTED",
          vendorId: 11,
          organizationId: 7,
        }),
        take: 1,
      }),
    );

    expect(
      mocks.normalizeFrameworkAssessmentFindingsInput,
    ).toHaveBeenCalledWith(frameworkResponses);

    expect(
      mocks.runGovernanceIntelligence,
    ).toHaveBeenCalledWith({
      assessmentId: 301,
      vendorName: "Acme Vendor",
      frameworkName: "Truvern Governance Review",
      responses: normalizedFrameworkResponses,
    });

    const updateInput =
      mocks.updateReviewResponse.mock.calls[0]?.[0] as any;

    const persisted =
      updateInput?.data?.responses as Record<string, any>;

    expect(
      persisted.intelligenceInput,
    ).toMatchObject({
      source: "FRAMEWORK_ASSESSMENT_RESPONSES",
      assessmentId: null,
      frameworkAssessmentId: 301,
      assessmentAnswerCount: 0,
      frameworkResponseCount: 1,
    });
  });

  it("persists reviewer intelligence, canonical artifact, and assignment outcome", async () => {
    mocks.findLatestReviewResponse.mockResolvedValue(
      legacyResponse({
        answers: [
          {
            questionId: 1,
            controlCode: "AC-1",
            answer: "partial",
            requiresEvidence: true,
            evidence: [],
          },
        ],
        retainedField: "must remain",
      }),
    );

    const response = await POST(
      request(),
      createRouteContext({ id: "42" }),
    );

    expect(response.status).toBe(200);

    expect(await readJsonResponse(response)).toEqual({
      ok: true,
      assignmentId: 42,
      recommendation: "HIGH_RISK",
      riskLevel: "HIGH",
      score: 48,
      findings: 1,
      followUps: 1,
    });

    expect(
      mocks.buildCanonicalGovernanceArtifact,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "HIGH_RISK",
        riskLevel: "HIGH",
        findings: [
          expect.objectContaining({
            title: "Missing evidence",
            severity: "HIGH",
            remediationRequired: true,
            evidenceRequired: true,
            attestationRequired: false,
          }),
        ],
      }),
    );

    expect(
      mocks.updateReviewResponse,
    ).toHaveBeenCalledTimes(1);

    const responseUpdate =
      mocks.updateReviewResponse.mock.calls[0];

    expect(responseUpdate[0]).toEqual(
      expect.objectContaining({
        id: 101,
      }),
    );

    const persisted =
      (responseUpdate[0] as any).data.responses as Record<string, any>;

    expect(persisted.retainedField).toBe("must remain");

    expect(persisted.truvernReviewerIntelligence).toMatchObject({
      schema: "truvern.reviewer_intelligence.v1",
      assessmentId: 42,
      vendorName: "Acme Vendor",
      score: {
        percent: 48,
        riskLevel: "HIGH",
      },
      findings: intelligence().findings,
      remediationRequired: true,
      attestationRequired: false,
      recommendation: "HIGH_RISK",
      metrics: intelligence().metrics,
    });

    expect(persisted.canonicalGovernanceArtifact).toMatchObject({
      schema: "truvern.canonical_governance_artifact.v1",
      decision: "HIGH_RISK",
      riskLevel: "HIGH",
    });

    expect(persisted.findings).toEqual([
      expect.objectContaining({
        title: "Missing evidence",
        severity: "HIGH",
        remediationRequired: true,
        evidenceRequired: true,
        attestationRequired: false,
      }),
    ]);

    expect(
      mocks.updateReviewAssignment,
    ).toHaveBeenCalledTimes(1);

    const assignmentUpdate =
      mocks.updateReviewAssignment.mock.calls[0][0] as any;

    expect(assignmentUpdate).toEqual(
      expect.objectContaining({
        where: {
          id: 42,
        },
        data: expect.objectContaining({
          riskLevel: "HIGH",
          decision: "HIGH_RISK",
          findings: expect.any(String),
        }),
      }),
    );

    const assignmentFindings =
      JSON.parse(assignmentUpdate.data.findings) as any[];

    expect(assignmentFindings).toEqual([
      expect.objectContaining({
        title: "Missing evidence",
        severity: "HIGH",
        remediationRequired: true,
        evidenceRequired: true,
        attestationRequired: false,
      }),
    ]);
  });

  it("returns a safe 500 response when reviewer access fails", async () => {
    mocks.requireReviewerAccess.mockRejectedValue(
      new Error("Reviewer access required."),
    );

    const response = await POST(
      request(),
      createRouteContext({ id: "42" }),
    );

    expect(response.status).toBe(500);
    expect(await readJsonResponse(response)).toEqual({
      ok: false,
      error: "Reviewer access required.",
    });

    expect(
      mocks.findReviewAssignment,
    ).not.toHaveBeenCalled();
  });
});
