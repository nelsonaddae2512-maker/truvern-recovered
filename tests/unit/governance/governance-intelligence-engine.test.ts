import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateFindings: vi.fn(),
  shouldRequestAttestation: vi.fn(),
  shouldRequestRemediation: vi.fn(),
}));

vi.mock("@/lib/governance/findings-engine", () => ({
  generateFindings: mocks.generateFindings,
  shouldRequestAttestation: mocks.shouldRequestAttestation,
  shouldRequestRemediation: mocks.shouldRequestRemediation,
}));

import { runGovernanceIntelligence } from "@/lib/governance/intelligence/governance-intelligence-engine";

function baseResult(overrides: Record<string, unknown> = {}) {
  return {
    score: {
      score: 90,
      maxScore: 100,
      percent: 90,
      riskLevel: "LOW",
      completedQuestions: 2,
      totalQuestions: 2,
      missingEvidence: 0,
      controls: [
        {
          controlKey: "AC-1",
          controlCode: "AC-1",
          family: "Access Control",
          score: 90,
          maxScore: 100,
          percent: 90,
          answeredQuestions: 2,
          totalQuestions: 2,
          missingEvidence: 0,
          requiresAttestation: false,
        },
      ],
    },
    findings: [],
    remediationRequired: false,
    attestationRequired: false,
    ...overrides,
  };
}

describe("governance intelligence engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldRequestRemediation.mockReturnValue(false);
    mocks.shouldRequestAttestation.mockReturnValue(false);
  });

  it("approves a low-risk assessment with no findings", () => {
    mocks.generateFindings.mockReturnValue(baseResult());

    const result = runGovernanceIntelligence({
      assessmentId: 42,
      vendorName: "Acme Vendor",
      frameworkName: "NIST 800-53",
      responses: [
        { questionId: 1, answer: "yes" },
        { questionId: 2, answer: "yes" },
      ],
    });

    expect(result).toMatchObject({
      version: "TRV-GOV-INTEL-1.0",
      assessmentId: 42,
      vendorName: "Acme Vendor",
      frameworkName: "NIST 800-53",
      recommendation: "APPROVED",
      remediationRequired: false,
      attestationRequired: false,
      followUps: [],
      metrics: {
        totalResponses: 2,
        completedQuestions: 2,
        missingEvidence: 0,
        criticalFindings: 0,
        highFindings: 0,
        moderateFindings: 0,
      },
    });

    expect(result.executiveSummary).toContain("90%");
    expect(result.executiveSummary).toContain("LOW");
    expect(result.finalRecommendation).toContain("Approved.");
  });

  it("requires remediation when the findings policy requires it", () => {
    mocks.generateFindings.mockReturnValue(
      baseResult({
        score: {
          ...baseResult().score,
          percent: 70,
          riskLevel: "MODERATE",
        },
        findings: [
          {
            title: "Missing incident response exercise",
            severity: "MODERATE",
            remediationRequired: true,
            evidenceRequired: false,
            attestationRequired: false,
          },
        ],
        remediationRequired: true,
      }),
    );
    mocks.shouldRequestRemediation.mockReturnValue(true);

    const result = runGovernanceIntelligence({
      responses: [{ questionId: 1, answer: "partial" }],
    });

    expect(result.recommendation).toBe("REMEDIATION_REQUIRED");
    expect(result.followUps).toEqual([
      "Remediation required: Missing incident response exercise",
    ]);
  });

  it("uses approved-with-conditions for attestation or non-blocking findings", () => {
    mocks.generateFindings.mockReturnValue(
      baseResult({
        findings: [
          {
            title: "Annual certification",
            severity: "LOW",
            remediationRequired: false,
            evidenceRequired: true,
            attestationRequired: true,
          },
        ],
        attestationRequired: true,
      }),
    );
    mocks.shouldRequestAttestation.mockReturnValue(true);

    const result = runGovernanceIntelligence({
      responses: [{ questionId: 1, answer: "yes" }],
    });

    expect(result.recommendation).toBe(
      "APPROVED_WITH_CONDITIONS",
    );
    expect(result.followUps).toEqual([
      "Evidence required: Annual certification",
      "Attestation required: Annual certification",
    ]);
  });

  it("escalates critical findings to not recommended", () => {
    mocks.generateFindings.mockReturnValue(
      baseResult({
        score: {
          ...baseResult().score,
          percent: 30,
          riskLevel: "CRITICAL",
        },
        findings: [
          {
            title: "Critical access-control failure",
            severity: "CRITICAL",
            remediationRequired: true,
            evidenceRequired: true,
            attestationRequired: false,
          },
        ],
      }),
    );

    expect(
      runGovernanceIntelligence({
        responses: [{ questionId: 1, answer: "no" }],
      }).recommendation,
    ).toBe("NOT_RECOMMENDED");
  });

  it("escalates high risk or three high findings", () => {
    mocks.generateFindings.mockReturnValue(
      baseResult({
        score: {
          ...baseResult().score,
          percent: 55,
          riskLevel: "HIGH",
        },
        findings: [],
      }),
    );

    expect(
      runGovernanceIntelligence({
        responses: [{ questionId: 1, answer: "partial" }],
      }).recommendation,
    ).toBe("HIGH_RISK");
  });
});
