import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = path.join(
  process.cwd(),
  "app",
  "review-desk",
  "[assignmentId]",
  "page.tsx",
);

const source = fs.readFileSync(pagePath, "utf8");

describe("canonical governance outcome read boundary", () => {
  it("prefers canonical decision over the legacy outcome decision", () => {
    const canonical =
      source.indexOf(
        "latestOutcomeResponses?.canonicalGovernanceArtifact?.decision",
      );

    const legacy =
      source.indexOf(
        "safeStr(latestOutcomeResponses?.decision)",
        canonical,
      );

    expect(canonical).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(canonical);
  });

  it("prefers canonical risk over the legacy outcome risk", () => {
    const canonical =
      source.indexOf(
        "latestOutcomeResponses?.canonicalGovernanceArtifact?.riskLevel",
      );

    const legacy =
      source.indexOf(
        "safeStr(latestOutcomeResponses?.riskLevel)",
        canonical,
      );

    expect(canonical).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(canonical);
  });

  it("prefers canonical governance follow-ups", () => {
    expect(source).toContain(
      "latestOutcomeResponses?.canonicalGovernanceArtifact?.conditionsAndFollowUps",
    );

    expect(source).toContain(
      "? latestOutcomeResponses.canonicalGovernanceArtifact.conditionsAndFollowUps",
    );
  });

  it("projects canonical follow-ups into the panel responses contract", () => {
    expect(source).toMatch(
      /followUps:\s*Array\.isArray\(\s*latestOutcomeResponses\?\.canonicalGovernanceArtifact\?\.conditionsAndFollowUps,/s,
    );
  });

  it("preserves the canonical artifact in structured assessment responses", () => {
    expect(source).toMatch(
      /canonicalGovernanceArtifact:\s*latestOutcomeResponses\?\.canonicalGovernanceArtifact/s,
    );
  });

  it("retains legacy follow-up fallback compatibility", () => {
    expect(source).toContain(
      "latestOutcomeResponses?.conditionsAndFollowUps",
    );

    expect(source).toContain(
      "latestOutcomeResponses?.structuredAssessment?.conditionsAndFollowUps",
    );
  });
});
