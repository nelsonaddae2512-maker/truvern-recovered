import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

describe("review findings materialization", () => {
  const route = read(
    "app/api/review-desk/reviews/[id]/generate-draft/route.ts",
  );

  const panel = read(
    "components/review-desk/findings-outcome-panel.client.tsx",
  );

  const workspace = read(
    "components/review-desk/review-assignment-workspace.client.tsx",
  );

  test("materializes response-driven findings into reviewer intelligence", () => {
    expect(route).toContain(
      "findings: responseDrivenFindingsV2.responseDrivenFindings",
    );

    expect(route).toContain(
      "responseDrivenFindingsV2: responseDrivenFindingsV2.responseDrivenFindings",
    );
  });

  test("renders previously stored response-driven findings", () => {
    expect(panel).toContain(
      "safeArray(intelligence.responseDrivenFindingsV2)",
    );

    expect(panel).toContain(
      "safeArray(intelligence.findings).length > 0",
    );
  });

  test("does not publish remediation merely because findings were generated", () => {
    expect(workspace).toContain(
      "Review the findings before publishing remediation requests.",
    );

    expect(workspace).not.toContain(
      'fetch(`/api/review-desk/reviews/${assignment.id}/publish-remediation`',
    );
  });
});