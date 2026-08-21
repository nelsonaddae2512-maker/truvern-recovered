import { describe, expect, it } from "vitest";
import {
  buildCanonicalGovernanceArtifact,
  cleanGovernanceConditions,
} from "@/lib/governance/canonical-governance-artifact";

describe("canonical governance artifact", () => {
  it("cleans, de-duplicates, and filters governance conditions", () => {
    expect(
      cleanGovernanceConditions([
        "Remediation: Rotate privileged credentials",
        "rotate privileged credentials",
        "Follow-up: Obtain annual SOC 2",
        "Condition: Notify Truvern of a material breach",
        "Executive Summary",
        "Not recorded.",
        "",
      ]),
    ).toEqual([
      "Rotate privileged credentials",
      "Obtain annual SOC 2",
      "Notify Truvern of a material breach",
    ]);
  });

  it("builds a stable canonical artifact with narrative fallbacks", () => {
    const artifact = buildCanonicalGovernanceArtifact({
      executiveSummary: "  Executive risk summary  ",
      finalAssessment: "Approved with conditions",
      decision: "APPROVED_WITH_CONDITIONS",
      riskLevel: "MODERATE",
      findings: [{ title: "Evidence gap" }],
      conditionsAndFollowUps: [
        "Remediation: Upload current penetration-test report",
      ],
      boardSummary: "",
      customerSummary: "Not recorded.",
    });

    expect(artifact.schema).toBe(
      "truvern.canonical_governance_artifact.v1",
    );
    expect(artifact.generatedAt).toEqual(expect.any(String));
    expect(artifact).toMatchObject({
      executiveSummary: "Executive risk summary",
      finalAssessment: "Approved with conditions",
      finalRecommendation: "Approved with conditions",
      decision: "APPROVED_WITH_CONDITIONS",
      riskLevel: "MODERATE",
      findings: [{ title: "Evidence gap" }],
      conditionsAndFollowUps: [
        "Upload current penetration-test report",
      ],
      boardSummary: "Executive risk summary",
      customerSummary: "Approved with conditions",
    });
  });

  it("normalizes blank and not-recorded fields", () => {
    const artifact = buildCanonicalGovernanceArtifact({
      executiveSummary: "Not recorded",
      finalAssessment: "",
      finalRecommendation: "Not recorded.",
      decision: "",
      riskLevel: null,
      findings: null as unknown as unknown[],
      conditionsAndFollowUps: [],
    });

    expect(artifact).toMatchObject({
      executiveSummary: "",
      finalAssessment: "",
      finalRecommendation: "",
      decision: null,
      riskLevel: null,
      findings: [],
      boardSummary: "",
      customerSummary: "",
    });
  });
});
