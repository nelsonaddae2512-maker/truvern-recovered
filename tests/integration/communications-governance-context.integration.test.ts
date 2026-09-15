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
  const standardRoute = readSource(
    "app",
    "api",
    "assessments",
    "[id]",
    "send-vendor-link",
    "route.ts",
  );

  const frameworkRoute = readSource(
    "app",
    "api",
    "truvern",
    "framework-assessments",
    "[id]",
    "send-vendor-link",
    "route.ts",
  );

  const standardService = readSource(
    "lib",
    "communications",
    "assessment-vendor-link.ts",
  );

  const frameworkService = readSource(
    "lib",
    "communications",
    "framework-assessment-vendor-link.ts",
  );

  it("delegates API delivery to the communication services", () => {
    expect(standardRoute).toContain(
      "sendAssessmentVendorLink",
    );

    expect(frameworkRoute).toContain(
      "sendFrameworkAssessmentVendorLink",
    );
  });

  it("propagates standard assessment review context", () => {
    expect(standardService).toContain(
      "reviewAssignmentId: true",
    );

    expect(standardService).toContain(
      "assessment.reviewAssignmentId",
    );

    expect(standardService).toContain(
      "organizationId:",
    );

    expect(standardService).toContain(
      "assessment.organizationId",
    );

    expect(standardService).toContain(
      "vendorId:",
    );

    expect(standardService).toContain(
      "assessment.vendorId",
    );

    expect(standardService).toContain(
      "reviewAssignment?.reviewRequestId ??",
    );

    expect(standardService).toContain(
      "reviewAssignment?.id ??",
    );
  });

  it("propagates framework run, assignment, and request context", () => {
    expect(frameworkService).toContain(
      "findReviewAssignment",
    );

    expect(frameworkService).toContain(
      "assessment.reviewAssignmentId",
    );

    expect(frameworkService).toContain(
      "reviewAssignment.organizationId ===",
    );

    expect(frameworkService).toContain(
      "reviewAssignment.vendorId === assessment.vendorId",
    );

    expect(frameworkService).toContain(
      "assessmentRunId:",
    );

    expect(frameworkService).toContain(
      "assessment.assessmentRunId",
    );

    expect(frameworkService).toContain(
      "linkedReviewAssignment",
    );

    expect(frameworkService).toContain(
      "?.reviewRequestId ?? null",
    );

    expect(frameworkService).toContain(
      "linkedReviewAssignment?.id ?? null",
    );
  });

  it("does not introduce direct Prisma model access in API routes", () => {
    expect(standardRoute).not.toContain(
      'import prisma from "@/lib/prisma"',
    );

    expect(frameworkRoute).not.toContain(
      'import prisma from "@/lib/prisma"',
    );

    expect(standardRoute).not.toContain(
      "prisma.reviewAssignment",
    );

    expect(frameworkRoute).not.toContain(
      "prisma.reviewAssignment",
    );
  });

  it("preserves deterministic conversation thread identities", () => {
    expect(standardService).toContain(
      "`assessment:${assessment.id}:vendor-link`",
    );

    expect(frameworkService).toContain(
      "`truvern-framework-assessment:${assessment.id}:vendor-link`",
    );
  });

  it("sends governance context through the communications layer", () => {
    expect(standardService).toContain(
      "sendCommunication",
    );

    expect(frameworkService).toContain(
      "sendCommunication",
    );

    expect(standardService).toContain(
      "externalThreadId",
    );

    expect(frameworkService).toContain(
      "externalThreadId",
    );
  });
});