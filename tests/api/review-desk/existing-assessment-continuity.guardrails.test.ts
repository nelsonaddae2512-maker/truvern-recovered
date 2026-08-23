import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const reviewPagePath = join(
  process.cwd(),
  "app",
  "review-desk",
  "[assignmentId]",
  "page.tsx",
);

function source() {
  return readFileSync(reviewPagePath, "utf8");
}

describe("existing assessment continuity", () => {
  it("derives the existing assessment from ReviewRequest.assessmentId", () => {
    const text = source();

    expect(text).toContain(
      "const linkedAssessmentId =",
    );

    expect(text).toContain(
      "safeInt(request?.assessmentId);",
    );
  });

  it("suppresses managed assessment creation for converted reviews", () => {
    const text = source();

    expect(text).toContain(
      'upper(assignment.assignmentType) === "TRUVERN" &&',
    );

    expect(text).toContain(
      "!linkedAssessmentId ? (",
    );

    expect(text).toContain(
      "<ManagedReviewAssessmentLauncher",
    );
  });

  it("keeps the managed launcher available when no assessment is linked", () => {
    const text = source();

    const launcherCount =
      text.split(
        "<ManagedReviewAssessmentLauncher",
      ).length - 1;

    expect(launcherCount).toBe(1);
  });
});
