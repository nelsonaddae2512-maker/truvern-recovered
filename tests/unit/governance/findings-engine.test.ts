import { describe, expect, it } from "vitest";
import {
  generateFindings,
  shouldRequestAttestation,
  shouldRequestRemediation,
  type TruvernFindingsResult,
  type TruvernGeneratedFinding,
} from "@/lib/governance/findings-engine";
import type {
  TruvernAssessmentScore,
  TruvernScoringInput,
} from "@/lib/governance/scoring-engine";

function item(
  overrides: Partial<TruvernScoringInput> = {},
): TruvernScoringInput {
  return {
    questionId: 1,
    controlId: "AC-1",
    controlCode: "AC-1",
    family: "Access Control",
    prompt: "Is the control implemented?",
    answer: "yes",
    maxScore: 10,
    requiresEvidence: false,
    requiresAttestation: false,
    evidence: [],
    ...overrides,
  };
}

function findingByTitle(
  findings: TruvernGeneratedFinding[],
  titleFragment: string,
): TruvernGeneratedFinding {
  const finding = findings.find((entry) =>
    entry.title.includes(titleFragment),
  );

  expect(finding).toBeDefined();

  return finding as TruvernGeneratedFinding;
}

function policyResult(
  overrides: Partial<TruvernFindingsResult> = {},
): TruvernFindingsResult {
  const score: TruvernAssessmentScore = {
    score: 100,
    maxScore: 100,
    percent: 100,
    riskLevel: "LOW",
    completedQuestions: 1,
    totalQuestions: 1,
    missingEvidence: 0,
    controls: [],
  };

  return {
    score,
    findings: [],
    remediationRequired: false,
    attestationRequired: false,
    ...overrides,
  };
}

describe("Truvern findings engine", () => {
  describe("control-gap severity and due dates", () => {
    it.each([
      {
        score: 0,
        severity: "CRITICAL",
        dueInDays: 7,
        remediationRequired: true,
      },
      {
        score: 4,
        severity: "HIGH",
        dueInDays: 14,
        remediationRequired: true,
      },
      {
        score: 6,
        severity: "MODERATE",
        dueInDays: 30,
        remediationRequired: true,
      },
      {
        score: 8,
        severity: "LOW",
        dueInDays: 60,
        remediationRequired: false,
      },
    ] as const)(
      "maps a $score/10 control to $severity with a $dueInDays-day due date",
      ({
        score,
        severity,
        dueInDays,
        remediationRequired,
      }) => {
        const result = generateFindings([
          item({
            score,
            maxScore: 10,
          }),
        ]);

        const finding = findingByTitle(
          result.findings,
          "control gap detected",
        );

        expect(finding).toMatchObject({
          controlKey: "AC-1",
          controlCode: "AC-1",
          family: "Access Control",
          severity,
          dueInDays,
          remediationRequired,
          evidenceRequired: false,
        });
      },
    );

    it("does not generate a control-gap finding at 90 percent", () => {
      const result = generateFindings([
        item({
          score: 9,
          maxScore: 10,
        }),
      ]);

      expect(
        result.findings.some((finding) =>
          finding.title.includes("control gap detected"),
        ),
      ).toBe(false);
    });

    it("does not generate findings for a perfect control", () => {
      const result = generateFindings([
        item({
          score: 10,
          maxScore: 10,
          evidence: [{ id: "evidence-1" }],
        }),
      ]);

      expect(result.findings).toEqual([]);
      expect(result.remediationRequired).toBe(false);
      expect(result.attestationRequired).toBe(false);
    });

    it("uses the control code and family in customer-facing labels", () => {
      const result = generateFindings([
        item({
          score: 4,
        }),
      ]);

      expect(result.findings[0]?.title).toBe(
        "AC-1 · Access Control control gap detected",
      );
    });

    it("falls back to the control key when code and family are absent", () => {
      const result = generateFindings([
        item({
          controlId: "control-77",
          controlCode: null,
          family: null,
          score: 4,
        }),
      ]);

      expect(result.findings[0]?.title).toContain(
        "control-77 control gap detected",
      );
    });

    it("uses strict remediation language for critical and high gaps", () => {
      const result = generateFindings([
        item({
          score: 3,
        }),
      ]);

      const finding = findingByTitle(
        result.findings,
        "control gap detected",
      );

      expect(finding.recommendation).toContain(
        "require reviewer validation before release",
      );
    });

    it("uses clarification language for moderate and low gaps", () => {
      const result = generateFindings([
        item({
          score: 7,
        }),
      ]);

      const finding = findingByTitle(
        result.findings,
        "control gap detected",
      );

      expect(finding.recommendation).toContain(
        "clarification or compensating evidence",
      );
    });
  });

  describe("evidence findings", () => {
    it("generates a separate evidence finding when required evidence is missing", () => {
      const result = generateFindings([
        item({
          score: 8,
          requiresEvidence: true,
          evidence: [],
        }),
      ]);

      const evidenceFinding = findingByTitle(
        result.findings,
        "evidence missing",
      );

      expect(evidenceFinding).toMatchObject({
        severity: "MODERATE",
        remediationRequired: true,
        attestationRequired: false,
        evidenceRequired: true,
        dueInDays: 30,
      });

      expect(evidenceFinding.description).toContain(
        "1 required evidence item(s)",
      );
    });

    it("escalates missing evidence to high below 75 percent", () => {
      const result = generateFindings([
        item({
          score: 6,
          requiresEvidence: true,
          evidence: null,
        }),
      ]);

      const evidenceFinding = findingByTitle(
        result.findings,
        "evidence missing",
      );

      expect(evidenceFinding).toMatchObject({
        severity: "HIGH",
        dueInDays: 14,
      });
    });

    it("does not generate an evidence finding when evidence exists", () => {
      const result = generateFindings([
        item({
          score: 8,
          requiresEvidence: true,
          evidence: [{ id: "policy-document" }],
        }),
      ]);

      expect(
        result.findings.some((finding) =>
          finding.title.includes("evidence missing"),
        ),
      ).toBe(false);
    });

    it("records evidence gaps in finding metadata", () => {
      const result = generateFindings([
        item({
          score: 8,
          requiresEvidence: true,
          evidence: [],
        }),
      ]);

      const evidenceFinding = findingByTitle(
        result.findings,
        "evidence missing",
      );

      expect(evidenceFinding.metadata).toEqual({
        missingEvidence: 1,
        controlPercent: 80,
      });
    });
  });

  describe("attestation findings", () => {
    it("generates an attestation finding for an imperfect attestation control", () => {
      const result = generateFindings([
        item({
          score: 8,
          requiresAttestation: true,
        }),
      ]);

      const attestationFinding = findingByTitle(
        result.findings,
        "attestation required",
      );

      expect(attestationFinding).toMatchObject({
        severity: "MODERATE",
        remediationRequired: false,
        attestationRequired: true,
        evidenceRequired: false,
        dueInDays: 30,
      });
    });

    it("escalates attestation findings below 75 percent", () => {
      const result = generateFindings([
        item({
          score: 6,
          requiresAttestation: true,
        }),
      ]);

      const attestationFinding = findingByTitle(
        result.findings,
        "attestation required",
      );

      expect(attestationFinding).toMatchObject({
        severity: "HIGH",
        remediationRequired: true,
        dueInDays: 14,
      });
    });

    it("does not generate an attestation finding for a perfect control", () => {
      const result = generateFindings([
        item({
          score: 10,
          requiresAttestation: true,
        }),
      ]);

      expect(
        result.findings.some((finding) =>
          finding.title.includes("attestation required"),
        ),
      ).toBe(false);
    });

    it("automatically requires attestation for a critical control gap", () => {
      const result = generateFindings([
        item({
          score: 3,
          requiresAttestation: false,
        }),
      ]);

      const gapFinding = findingByTitle(
        result.findings,
        "control gap detected",
      );

      expect(gapFinding).toMatchObject({
        severity: "CRITICAL",
        attestationRequired: true,
      });

      expect(result.attestationRequired).toBe(true);
    });
  });

  describe("combined findings and aggregation", () => {
    it("preserves separate gap, evidence, and attestation findings", () => {
      const result = generateFindings([
        item({
          score: 6,
          requiresEvidence: true,
          requiresAttestation: true,
          evidence: [],
        }),
      ]);

      expect(result.findings).toHaveLength(3);

      expect(
        result.findings.map((finding) => finding.title),
      ).toEqual(
        expect.arrayContaining([
          "AC-1 · Access Control control gap detected",
          "AC-1 · Access Control evidence missing",
          "AC-1 · Access Control attestation required",
        ]),
      );
    });

    it("does not emit duplicate finding records", () => {
      const result = generateFindings([
        item({
          questionId: 1,
          score: 4,
          requiresEvidence: true,
          evidence: [],
        }),
        item({
          questionId: 2,
          score: 4,
          requiresEvidence: true,
          evidence: [],
        }),
      ]);

      const keys = result.findings.map((finding) =>
        [
          finding.controlKey,
          finding.title,
          finding.severity,
          finding.evidenceRequired,
          finding.attestationRequired,
        ].join(":"),
      );

      expect(new Set(keys).size).toBe(keys.length);
    });

    it("aggregates multiple questions into a single control score", () => {
      const result = generateFindings([
        item({
          questionId: 1,
          score: 10,
          maxScore: 10,
        }),
        item({
          questionId: 2,
          score: 4,
          maxScore: 10,
        }),
      ]);

      expect(result.score.controls).toHaveLength(1);
      expect(result.score.controls[0]).toMatchObject({
        controlKey: "AC-1",
        score: 14,
        maxScore: 20,
        percent: 70,
        answeredQuestions: 2,
        totalQuestions: 2,
      });

      expect(
        result.findings.filter((finding) =>
          finding.title.includes("control gap detected"),
        ),
      ).toHaveLength(1);
    });

    it("sets aggregate remediation and attestation flags from findings", () => {
      const result = generateFindings([
        item({
          score: 6,
          requiresAttestation: true,
        }),
      ]);

      expect(result.remediationRequired).toBe(true);
      expect(result.attestationRequired).toBe(true);
    });

    it("returns the assessment score with generated findings", () => {
      const result = generateFindings([
        item({
          score: 4,
          maxScore: 10,
        }),
      ]);

      expect(result.score).toMatchObject({
        score: 4,
        maxScore: 10,
        percent: 40,
        riskLevel: "CRITICAL",
        completedQuestions: 1,
        totalQuestions: 1,
      });
    });
  });

  describe("policy helpers", () => {
    it("requests remediation when a generated finding requires remediation", () => {
      expect(
        shouldRequestRemediation(
          policyResult({
            remediationRequired: true,
          }),
        ),
      ).toBe(true);
    });

    it.each(["HIGH", "CRITICAL"] as const)(
      "requests remediation for %s assessment risk",
      (riskLevel) => {
        expect(
          shouldRequestRemediation(
            policyResult({
              score: {
                ...policyResult().score,
                riskLevel,
              },
            }),
          ),
        ).toBe(true);
      },
    );

    it.each(["LOW", "MODERATE"] as const)(
      "does not request remediation for %s risk without remediation findings",
      (riskLevel) => {
        expect(
          shouldRequestRemediation(
            policyResult({
              score: {
                ...policyResult().score,
                riskLevel,
              },
            }),
          ),
        ).toBe(false);
      },
    );

    it("requests attestation when the result flag is set", () => {
      expect(
        shouldRequestAttestation(
          policyResult({
            attestationRequired: true,
          }),
        ),
      ).toBe(true);
    });

    it("requests attestation when a critical finding exists", () => {
      expect(
        shouldRequestAttestation(
          policyResult({
            findings: [
              {
                controlKey: "AC-1",
                controlCode: "AC-1",
                family: "Access Control",
                severity: "CRITICAL",
                title: "Critical control gap",
                description: "Critical governance weakness.",
                recommendation: "Remediate immediately.",
                remediationRequired: true,
                attestationRequired: false,
                evidenceRequired: false,
                dueInDays: 7,
                metadata: {},
              },
            ],
          }),
        ),
      ).toBe(true);
    });

    it("does not request attestation without a flag or critical finding", () => {
      expect(
        shouldRequestAttestation(
          policyResult({
            findings: [
              {
                controlKey: "AC-1",
                controlCode: "AC-1",
                family: "Access Control",
                severity: "HIGH",
                title: "High control gap",
                description: "High governance weakness.",
                recommendation: "Remediate.",
                remediationRequired: true,
                attestationRequired: false,
                evidenceRequired: false,
                dueInDays: 14,
                metadata: {},
              },
            ],
          }),
        ),
      ).toBe(false);
    });
  });
});
