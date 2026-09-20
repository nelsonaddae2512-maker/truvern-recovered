import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "app/api/review-desk/reviews/[id]/remediation-action/route.ts",
  "utf8",
);

describe("remediation-action assignment authorization guardrails", () => {
  it("uses assignment-scoped authorization instead of the broad reviewer gate", () => {
    expect(source).toContain("requireReviewAssignmentAccess");
    expect(source).not.toContain("requireReviewerAccess");
  });

  it("authorizes the validated assignment before parsing the request body", () => {
    const parseIdIndex = source.indexOf(
      "const assignmentId = safeInt(params?.id);",
    );
    const invalidIdIndex = source.indexOf(
      "if (!assignmentId)",
    );
    const authIndex = source.indexOf(
      "await requireReviewAssignmentAccess(assignmentId);",
    );
    const bodyIndex = source.indexOf(
      "const body = await request.json()",
    );

    expect(parseIdIndex).toBeGreaterThanOrEqual(0);
    expect(invalidIdIndex).toBeGreaterThan(parseIdIndex);
    expect(authIndex).toBeGreaterThan(invalidIdIndex);
    expect(bodyIndex).toBeGreaterThan(authIndex);
  });

  it("authorizes before review-response reads or mutations", () => {
    const authIndex = source.indexOf(
      "await requireReviewAssignmentAccess(assignmentId);",
    );
    const readIndex = source.indexOf(
      "const response = await findLatestReviewResponse(assignmentId);",
    );
    const mutationIndex = source.indexOf(
      "await updateReviewResponse(",
    );

    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(readIndex).toBeGreaterThan(authIndex);
    expect(mutationIndex).toBeGreaterThan(authIndex);
  });

  it("maps governance authorization errors before rethrowing other failures", () => {
    const authMapIndex = source.indexOf(
      "const authError = governanceAuthErrorResponse(error);",
    );
    const returnIndex = source.indexOf(
      "return authError;",
      authMapIndex,
    );
    const rethrowIndex = source.indexOf(
      "throw error;",
      authMapIndex,
    );

    expect(authMapIndex).toBeGreaterThanOrEqual(0);
    expect(returnIndex).toBeGreaterThan(authMapIndex);
    expect(rethrowIndex).toBeGreaterThan(returnIndex);
  });
});
