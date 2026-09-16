import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

const pagePath =
  "app/review-desk/[assignmentId]/page.tsx";

const workspacePath =
  "components/review-desk/review-assignment-workspace.client.tsx";

const findingsPanelPath =
  "components/review-desk/findings-outcome-panel.client.tsx";

const generateFindingsPath =
  "app/api/review-desk/reviews/[id]/generate-findings/route.ts";

const downstreamPaths = [
  "app/api/review-desk/reviews/[id]/publish-remediation/route.ts",
  "app/api/review-desk/reviews/[id]/remediation-action/route.ts",
  "app/api/review-desk/reviews/[id]/attestation/route.ts",
  "app/api/review-desk/reviews/[id]/outcome/route.ts",
  "app/api/review-desk/reviews/[id]/confirm-release/route.ts",
  "app/api/review-desk/reviews/[id]/release-manifest/route.ts",
  "lib/services/review-release-service.ts",
  "lib/repositories/review-release-repository.ts",
] as const;

describe(
  "framework Review Desk continuity guardrails",
  () => {
    it(
      "resolves a submitted framework assessment by review assignment",
      () => {
        const source = read(pagePath);

        expect(source).toContain(
          "prisma.truvernFrameworkAssessment.findFirst",
        );

        expect(source).toMatch(
          /reviewAssignmentId:\s*assignmentId/,
        );

        expect(source).toMatch(
          /status:\s*"SUBMITTED"/,
        );

        expect(source).toContain(
          "submittedFrameworkAssessment?.responses.map",
        );
      },
    );

    it(
      "uses framework answers only when ordinary submitted answers are absent",
      () => {
        const source = read(pagePath);

        expect(source).toContain(
          "const frameworkVendorAnswers",
        );

        expect(source).toMatch(
          /vendorAnswers=\{submittedAssessmentAnswers\.length\s*>\s*0\s*\?\s*submittedAssessmentAnswers\s*:\s*frameworkVendorAnswers\}/,
        );
      },
    );

    it(
      "keeps framework findings generation on the assignment-scoped intelligence route",
      () => {
        const source = read(generateFindingsPath);

        expect(source).toContain(
          "findTruvernFrameworkAssessments",
        );

        expect(source).toContain(
          "normalizeFrameworkAssessmentFindingsInput",
        );

        expect(source).toMatch(
          /reviewAssignmentId:\s*assignmentId/,
        );

        expect(source).toContain(
          '"FRAMEWORK_ASSESSMENT_RESPONSES"',
        );

        expect(source).toMatch(
          /linkedAssessmentId\s*\?\?\s*frameworkAssessment\?\.id\s*\?\?\s*assignmentId/,
        );
      },
    );

    it(
      "keeps active Review Desk actions assignment scoped",
      () => {
        const workspace = read(workspacePath);
        const findingsPanel = read(findingsPanelPath);

        expect(workspace).toContain(
          "/api/review-desk/reviews/${assignment.id}/publish-remediation",
        );

        expect(workspace).toContain(
          "/api/review-desk/reviews/${assignment.id}/outcome",
        );

        expect(workspace).toContain(
          "/api/review-desk/reviews/${assignment.id}/confirm-release",
        );

        expect(workspace).toContain(
          "/api/review-desk/reviews/${assignment.id}/attestation",
        );

        expect(findingsPanel).toContain(
          "/api/review-desk/reviews/${assignmentId}/remediation-action",
        );

        expect(findingsPanel).toContain(
          "/api/review-desk/reviews/${assignmentId}/generate-findings",
        );
      },
    );

    it(
      "does not route the main Review Desk workspace into the standalone framework lifecycle",
      () => {
        const combined = [
          read(pagePath),
          read(workspacePath),
          read(findingsPanelPath),
        ].join("\n");

        expect(combined).not.toContain(
          "/api/truvern/framework-assessments/",
        );
      },
    );

    it(
      "does not require an ordinary Assessment in downstream assignment lifecycle routes",
      () => {
        const forbiddenPatterns = [
          /\bprisma\.assessment\b/i,
          /\bAssessmentAnswer\b/i,
          /\bassessmentAnswer\b/i,
          /\blinkedAssessmentId\b/i,
          /\breviewRequest\.assessmentId\b/i,
          /assessmentId:\s*assignmentId/i,
        ];

        for (const relativePath of downstreamPaths) {
          const source = read(relativePath);

          for (const pattern of forbiddenPatterns) {
            expect(
              source,
              `${relativePath} must remain assignment scoped; forbidden ordinary-assessment dependency: ${pattern}`,
            ).not.toMatch(pattern);
          }
        }
      },
    );
  },
);