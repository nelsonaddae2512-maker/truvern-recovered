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
  "generate-findings",
  "route.ts",
);

const route = fs.readFileSync(routePath, "utf8");

describe("generate-findings canonical finding adapter", () => {
  test("adapts legacy requirement arrays into canonical obligation flags", () => {
    expect(route).toContain("const canonicalFindings = (");

    expect(route).toContain(
      'typeof finding?.remediationRequired === "boolean"',
    );

    expect(route).toContain(
      ": requiredEvidence.length > 0",
    );

    expect(route).toContain(
      'typeof finding?.attestationRequired === "boolean"',
    );

    expect(route).toContain(
      ": requiredAttestation.length > 0",
    );
  });

  test("evaluates canonical policy using adapted findings", () => {
    expect(route).toMatch(
      /deriveCanonicalGovernanceOutcome\(\{[\s\S]*findings:\s*canonicalFindings,/,
    );
  });

  test("uses the adapted findings in the canonical artifact", () => {
    expect(route).toMatch(
      /buildCanonicalGovernanceArtifact\(\{[\s\S]*findings:\s*canonicalFindings,/,
    );
  });

  test("persists adapted findings in reviewer intelligence", () => {
    expect(route).toMatch(
      /const persistedReviewerIntelligence = \{[\s\S]*findings:\s*canonicalFindings,/,
    );
  });

  test("persists adapted findings to ReviewAssignment", () => {
    expect(route).toContain(
      "JSON.stringify(\n              canonicalFindings,",
    );
  });

  test("does not pass raw intelligence findings into canonical policy", () => {
    expect(route).not.toContain(
      "findings: Array.isArray(intelligence.findings) ? intelligence.findings : []",
    );
  });
});
