import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const routePath = path.join(
  process.cwd(),
  "app",
  "api",
  "review-desk",
  "reviews",
  "[id]",
  "generate-draft",
  "route.ts",
);

const clientPath = path.join(
  process.cwd(),
  "components",
  "review-desk",
  "review-assignment-workspace.client.tsx",
);

const route = fs.readFileSync(routePath, "utf8");
const client = fs.readFileSync(clientPath, "utf8");

describe("generate-draft assessment continuity", () => {
  test("derives authoritative assessment identity from ReviewRequest", () => {
    expect(route).toContain(
      "const linkedAssessmentId = safeInt(request.assessmentId);",
    );
  });

  test("selects the exact linked assessment when present", () => {
    expect(route).toContain(
      "where: linkedAssessmentId",
    );

    expect(route).toContain(
      "id: linkedAssessmentId,",
    );

    expect(route).toContain(
      "organizationId: vendor.organizationId,",
    );
  });

  test("scopes Findings Engine answer rows to the exact assessment", () => {
    expect(route).toContain(
      "assessmentId: linkedAssessmentId,",
    );

    expect(route).toContain(
      "answers: assessmentAnswerRowsForFindings.length",
    );
  });

  test("retains legacy vendor fallback only when no assessment is linked", () => {
    expect(route).toContain(
      'in: ["SUBMITTED", "REVIEW_READY"],',
    );

    expect(route).toContain(
      "orderBy: linkedAssessmentId",
    );
  });

  test("presents generation as review-draft generation, not assessment creation", () => {
    expect(client).toContain(
      '"Generate review draft"',
    );

    expect(client).toContain(
      '"Generating review draft..."',
    );

    expect(client).not.toContain(
      ': "Generate assessment"}',
    );
  });

  test("generateDraft still calls only the generate-draft endpoint", () => {
    expect(client).toContain(
      "fetch(`/api/review-desk/reviews/${assignment.id}/generate-draft`, {",
    );
  });
});
