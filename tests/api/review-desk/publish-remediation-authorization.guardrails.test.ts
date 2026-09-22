import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routePath =
  "app/api/review-desk/reviews/[id]/publish-remediation/route.ts";

function readRoute(): string {
  return fs.readFileSync(
    path.join(process.cwd(), routePath),
    "utf8",
  );
}

describe("publish-remediation authorization guardrails", () => {
  it("requires assessment.review capability", () => {
    const source = readRoute();

    expect(source).toContain(
      "requireGovernanceCapability",
    );

    expect(source).toMatch(
      /requireGovernanceCapability\s*\(\s*actor\s*,\s*"assessment\.review"\s*,?\s*\)/,
    );
  });

  it("authorizes the review assignment before loading it", () => {
    const source = readRoute();

    const assignmentAccess =
      source.indexOf(
        "await requireReviewAssignmentAccess(",
      );

    const assignmentRead =
      source.indexOf(
        "await findReviewAssignment({",
      );

    expect(assignmentAccess).toBeGreaterThan(-1);
    expect(assignmentRead).toBeGreaterThan(-1);
    expect(assignmentAccess).toBeLessThan(
      assignmentRead,
    );
  });

  it("orders reviewer, capability, assignment, then resource read", () => {
    const source = readRoute();

    const reviewerAccess =
      source.indexOf(
        "await requireReviewerAccess()",
      );

    const capabilityAccess =
      source.indexOf(
        "requireGovernanceCapability(",
      );

    const assignmentAccess =
      source.indexOf(
        "await requireReviewAssignmentAccess(",
      );

    const assignmentRead =
      source.indexOf(
        "await findReviewAssignment({",
      );

    expect(reviewerAccess).toBeGreaterThan(-1);
    expect(capabilityAccess).toBeGreaterThan(-1);
    expect(assignmentAccess).toBeGreaterThan(-1);
    expect(assignmentRead).toBeGreaterThan(-1);

    expect(reviewerAccess).toBeLessThan(
      capabilityAccess,
    );

    expect(capabilityAccess).toBeLessThan(
      assignmentAccess,
    );

    expect(assignmentAccess).toBeLessThan(
      assignmentRead,
    );
  });

  it("retains governance authorization error mapping", () => {
    const source = readRoute();

    expect(source).toContain(
      "governanceAuthErrorResponse",
    );
  });
});