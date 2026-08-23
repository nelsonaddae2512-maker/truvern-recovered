import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pagePath = path.join(
  process.cwd(),
  "app",
  "review-desk",
  "[assignmentId]",
  "page.tsx",
);

const source = fs.readFileSync(pagePath, "utf8");

describe("route-aware review continuity", () => {
  test("uses Professional Review copy for converted Truvern reviews", () => {
    expect(source).toContain(
      "Professional Review workspace. Truvern Ops is reviewing the existing assessment",
    );

    expect(source).toContain(
      "without creating a second questionnaire.",
    );
  });

  test("retains self-managed copy for internal reviews", () => {
    expect(source).toContain(
      "Self-managed review workspace for evidence review, findings, remediation, attestations, and governance release operations.",
    );
  });

  test("uses the exact ReviewRequest assessment when linked", () => {
    expect(source).toContain(
      "const submittedAssessment = linkedAssessmentId",
    );

    expect(source).toContain(
      "id: linkedAssessmentId,",
    );
  });

  test("keeps vendor-wide lookup as fallback only", () => {
    expect(source).toContain(
      ': await prisma.assessment.findFirst({',
    );

    expect(source).toContain(
      'in: ["SUBMITTED", "REVIEW_READY"],',
    );
  });

  test("continues suppressing duplicate managed assessment creation", () => {
    expect(source).toContain(
      'upper(assignment.assignmentType) === "TRUVERN" &&',
    );

    expect(source).toContain(
      "!linkedAssessmentId ? (",
    );
  });
});
