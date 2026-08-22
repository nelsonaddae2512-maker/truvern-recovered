import {
  describe,
  expect,
  it,
} from "vitest";

import fs from "node:fs";
import path from "node:path";

function readSource(...parts: string[]) {
  return fs.readFileSync(
    path.join(process.cwd(), ...parts),
    "utf8",
  );
}

describe("RC40L governance-linked communications", () => {
  const standard = readSource(
    "app",
    "api",
    "assessments",
    "[id]",
    "send-vendor-link",
    "route.ts",
  );

  const framework = readSource(
    "app",
    "api",
    "truvern",
    "framework-assessments",
    "[id]",
    "send-vendor-link",
    "route.ts",
  );

  it("propagates standard assessment review context", () => {
    expect(standard).toContain(
      'findReviewAssignment',
    );

    expect(standard).toContain(
      "reviewAssignmentId: true",
    );

    expect(standard).toContain(
      "id: assessment.reviewAssignmentId",
    );

    expect(standard).toContain(
      "reviewAssignment.organizationId ===",
    );

    expect(standard).toContain(
      "reviewAssignment.vendorId ===",
    );

    expect(standard).toContain(
      "linkedReviewAssignment?.reviewRequestId ?? null",
    );

    expect(standard).toContain(
      "linkedReviewAssignment?.id ?? null",
    );
  });

  it("propagates framework run, assignment, and request context", () => {
    expect(framework).toContain(
      'findReviewAssignment',
    );

    expect(framework).toContain(
      "id: assessment.reviewAssignmentId",
    );

    expect(framework).toContain(
      "assessmentRunId: assessment.assessmentRunId",
    );

    expect(framework).toContain(
      "linkedReviewAssignment?.reviewRequestId ?? null",
    );

    expect(framework).toContain(
      "linkedReviewAssignment?.id ?? null",
    );
  });

  it("does not introduce direct Prisma model access in API routes", () => {
    expect(standard).not.toContain(
      'import prisma from "@/lib/prisma"',
    );

    expect(framework).not.toContain(
      'import prisma from "@/lib/prisma"',
    );

    expect(standard).not.toContain(
      "prisma.reviewAssignment",
    );

    expect(framework).not.toContain(
      "prisma.reviewAssignment",
    );
  });

  it("preserves deterministic conversation thread identities", () => {
    expect(standard).toContain(
      "`assessment:${assessment.id}:vendor-link`",
    );

    expect(framework).toContain(
      "`truvern-framework-assessment:${assessment.id}:vendor-link`",
    );
  });
});
