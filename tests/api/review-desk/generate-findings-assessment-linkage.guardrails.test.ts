import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routePath = path.resolve(
  process.cwd(),
  "app/api/review-desk/reviews/[id]/generate-findings/route.ts",
);

const source = fs.readFileSync(routePath, "utf8");

describe("generate-findings assessment linkage", () => {
  it("reads the ReviewRequest assessment linkage", () => {
    expect(source).toContain(
      'findReviewRequest',
    );
    expect(source).toContain(
      'assessmentId: true',
    );
    expect(source).toContain(
      'const linkedAssessmentId =',
    );
  });

  it("loads AssessmentAnswer rows from the linked assessment", () => {
    expect(source).toContain(
      'findAssessmentAnswers',
    );
    expect(source).toContain(
      'assessmentId: linkedAssessmentId',
    );
    expect(source).toContain(
      'const assessmentScoringResponses',
    );
  });
  it("preserves false boolean answers for scoring", () => {
    expect(source).toContain(
      "function normalizeAssessmentAnswerValue(",
    );
    expect(source).toContain(
      'typeof candidate === "boolean"',
    );
    expect(source).toContain(
      "normalizeAssessmentAnswerValue(",
    );
    expect(source).toContain(
      "answer.valueJson",
    );
    expect(source).toContain(
      "answer.value",
    );
  });

  it("prefers ordinary answers, then framework responses, then legacy ReviewResponse arrays", () => {
    expect(source).toContain(
      'assessmentScoringResponses.length > 0',
    );
    expect(source).toContain(
      '? assessmentScoringResponses',
    );
    expect(source).toContain(
      'frameworkScoringResponses.length > 0',
    );
    expect(source).toContain(
      '? frameworkScoringResponses',
    );
    expect(source).toContain(
      ': legacyScoringResponses',
    );
  });

  it("loads and normalizes framework responses by review assignment", () => {
    expect(source).toContain(
      'findTruvernFrameworkAssessments',
    );
    expect(source).toContain(
      'reviewAssignmentId: assignmentId',
    );
    expect(source).toContain(
      'normalizeFrameworkAssessmentFindingsInput(',
    );
    expect(source).toContain(
      '"FRAMEWORK_ASSESSMENT_RESPONSES"',
    );
  });

  it("passes ordinary or framework assessment identity into governance intelligence", () => {
    expect(source).toMatch(
      /assessmentId:\s*linkedAssessmentId\s*\?\?\s*frameworkAssessment\?\.id\s*\?\?\s*assignmentId/,
    );
  });

  it("records intelligence input provenance", () => {
    expect(source).toContain(
      'intelligenceInput: {',
    );
    expect(source).toContain(
      'source: scoringSource',
    );
    expect(source).toContain(
      'assessmentAnswerCount:',
    );
    expect(source).toContain(
      'frameworkAssessmentId:',
    );
    expect(source).toContain(
      'frameworkResponseCount:',
    );
  });
});
