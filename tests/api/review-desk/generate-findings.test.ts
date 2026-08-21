import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRouteContext,
  readJsonResponse,
} from "@/tests/support/http";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess:
    vi.fn<() => Promise<void>>(),
  queryRawUnsafe:
    vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  executeRawUnsafe:
    vi.fn<(...args: unknown[]) => Promise<number>>(),
  runGovernanceIntelligence:
    vi.fn<(...args: unknown[]) => any>(),
  buildCanonicalGovernanceArtifact:
    vi.fn<(...args: unknown[]) => any>(),
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
    $executeRawUnsafe: mocks.executeRawUnsafe,
  },
}));

vi.mock(
  "@/lib/governance/intelligence/governance-intelligence-engine",
  () => ({
    runGovernanceIntelligence:
      mocks.runGovernanceIntelligence,
  }),
);

vi.mock(
  "@/lib/governance/canonical-governance-artifact",
  () => ({
    buildCanonicalGovernanceArtifact:
      mocks.buildCanonicalGovernanceArtifact,
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

describe("POST generate-findings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireReviewerAccess.mockResolvedValue();
    mocks.executeRawUnsafe.mockResolvedValue(1);
    mocks.runGovernanceIntelligence.mockReturnValue(
      intelligence(),
    );
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
      expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
    },
  );

  it("returns 404 when the assignment does not exist", async () => {
    mocks.queryRawUnsafe.mockResolvedValue([]);

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
    mocks.queryRawUnsafe.mockResolvedValue([
      {
        assignmentId: 42,
        organizationId: 7,
        vendorId: 11,
        vendorName: "Acme Vendor",
        responseId: 101,
        responses: {},
      },
    ]);

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
    mocks.queryRawUnsafe.mockResolvedValue([
      {
        assignmentId: 42,
        organizationId: 7,
        vendorId: 11,
        vendorName: "Acme Vendor",
        responseId: 101,
        responses: {
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
        },
      },
    ]);

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

  it("persists reviewer intelligence, canonical artifact, and assignment outcome", async () => {
    mocks.queryRawUnsafe.mockResolvedValue([
      {
        assignmentId: 42,
        organizationId: 7,
        vendorId: 11,
        vendorName: "Acme Vendor",
        responseId: 101,
        responses: {
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
        },
      },
    ]);

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
        findings: intelligence().findings,
      }),
    );

    expect(mocks.executeRawUnsafe).toHaveBeenCalledTimes(2);

    const responseUpdate =
      mocks.executeRawUnsafe.mock.calls[0];
    expect(String(responseUpdate[0])).toContain(
      'update "ReviewResponse"',
    );
    expect(responseUpdate[2]).toBe(101);

    const persisted = JSON.parse(
      String(responseUpdate[1]),
    ) as Record<string, any>;

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
    expect(persisted.findings).toEqual(
      intelligence().findings,
    );

    const assignmentUpdate =
      mocks.executeRawUnsafe.mock.calls[1];

    expect(String(assignmentUpdate[0])).toContain(
      'update "ReviewAssignment"',
    );
    expect(assignmentUpdate.slice(1)).toEqual([
      "HIGH",
      "HIGH_RISK",
      JSON.stringify(intelligence().findings, null, 2),
      42,
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
    expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
  });
});
