import {
  describe,
  expect,
  it,
} from "vitest";

import fs from "node:fs";
import path from "node:path";

describe("RC40L explicit review path propagation", () => {
  const chooser = fs.readFileSync(
    path.join(
      process.cwd(),
      "components",
      "assessment-start-chooser.tsx",
    ),
    "utf8",
  );

  const assignmentRoute = fs.readFileSync(
    path.join(
      process.cwd(),
      "app",
      "api",
      "review-desk",
      "assignments",
      "route.ts",
    ),
    "utf8",
  );

  it("provides explicit Self-Managed and Truvern review paths", () => {
    expect(chooser).toContain(
      'useState<"internal" | "truvern">("internal")',
    );

    expect(chooser).toContain(
      "Run Self-Managed Review",
    );

    expect(chooser).toContain(
      "Request Truvern Review",
    );
  });

  it("requires Truvern acknowledgement", () => {
    expect(chooser).toContain(
      "acceptedTruvernAcknowledgement",
    );

    expect(chooser).toContain(
      "TRV-LEGAL-1.0",
    );
  });

  it("propagates the launched assessment id", () => {
    expect(chooser).toContain(
      "const launchedAssessmentId",
    );

    expect(chooser).toContain(
      "assessmentId: launchedAssessmentId",
    );

    expect(chooser).toContain(
      'mode: "truvern"',
    );
  });

  it("binds an existing assessment to the Truvern assignment", () => {
    expect(assignmentRoute).toContain(
      "if (assessmentId) {",
    );

    expect(assignmentRoute).toContain(
      '"reviewAssignmentId" = ${assignment.id}',
    );

    expect(assignmentRoute).toContain(
      "where id = ${assessmentId}",
    );

    expect(assignmentRoute).toContain(
      "already linked to another review assignment",
    );
  });

  it("preserves direct Truvern questionnaire creation", () => {
    expect(assignmentRoute).toContain(
      "} else {",
    );

    expect(assignmentRoute).toContain(
      'insert into "Assessment"',
    );
  });
});
