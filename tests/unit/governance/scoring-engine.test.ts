import { describe, expect, it } from "vitest";
import {
  calculateRiskLevel,
  normalizeAnswerScore,
  scoreAssessment,
} from "@/lib/governance/scoring-engine";

describe("Truvern governance scoring engine", () => {
  it.each([
    ["yes", 10],
    ["implemented", 10],
    ["partial", 4],
    ["planned", 4],
    ["no", 0],
    ["not implemented", 0],
    ["documented and monitored", 9],
    ["working on implementation", 3],
    ["unrecognized narrative", 5],
  ])(
    "normalizes %s into the expected weighted score",
    (answer, expected) => {
      expect(
        normalizeAnswerScore({
          answer,
          maxScore: 10,
          weight: 10,
        }),
      ).toMatchObject({
        score: expected,
        maxScore: 10,
        answered: true,
      });
    },
  );

  it("treats unanswered questions as incomplete", () => {
    expect(
      normalizeAnswerScore({
        answer: "   ",
        maxScore: 5,
      }),
    ).toEqual({
      score: 0,
      maxScore: 5,
      answered: false,
    });
  });

  it("honors an explicit score while clamping it to maxScore", () => {
    expect(
      normalizeAnswerScore({
        answer: "yes",
        score: 15,
        maxScore: 10,
      }),
    ).toEqual({
      score: 10,
      maxScore: 10,
      answered: true,
    });
  });

  it.each([
    [100, "LOW"],
    [85, "LOW"],
    [84, "MODERATE"],
    [65, "MODERATE"],
    [64, "HIGH"],
    [45, "HIGH"],
    [44, "CRITICAL"],
    [0, "CRITICAL"],
  ])("maps %d percent to %s risk", (percent, expected) => {
    expect(calculateRiskLevel(percent)).toBe(expected);
  });

  it("scores controls, missing evidence, completion, and attestation flags", () => {
    const result = scoreAssessment([
      {
        questionId: 1,
        controlId: "AC-1",
        controlCode: "AC-1",
        family: "Access Control",
        answer: "yes",
        maxScore: 10,
        requiresEvidence: true,
        evidence: [{ id: 1 }],
      },
      {
        questionId: 2,
        controlId: "AC-1",
        controlCode: "AC-1",
        family: "Access Control",
        answer: "partial",
        maxScore: 10,
        requiresEvidence: true,
        evidence: [],
        requiresAttestation: true,
      },
      {
        questionId: 3,
        controlId: "IR-1",
        controlCode: "IR-1",
        family: "Incident Response",
        answer: null,
        maxScore: 10,
      },
    ]);

    expect(result).toMatchObject({
      score: 14,
      maxScore: 30,
      percent: 47,
      riskLevel: "HIGH",
      completedQuestions: 2,
      totalQuestions: 3,
      missingEvidence: 1,
    });

    expect(result.controls).toEqual([
      expect.objectContaining({
        controlKey: "AC-1",
        score: 14,
        maxScore: 20,
        percent: 70,
        answeredQuestions: 2,
        totalQuestions: 2,
        missingEvidence: 1,
        requiresAttestation: true,
      }),
      expect.objectContaining({
        controlKey: "IR-1",
        score: 0,
        maxScore: 10,
        percent: 0,
        answeredQuestions: 0,
        totalQuestions: 1,
      }),
    ]);
  });

  it("returns a deterministic empty assessment result", () => {
    expect(scoreAssessment([])).toEqual({
      score: 0,
      maxScore: 0,
      percent: 0,
      riskLevel: "CRITICAL",
      completedQuestions: 0,
      totalQuestions: 0,
      missingEvidence: 0,
      controls: [],
    });
  });
});
