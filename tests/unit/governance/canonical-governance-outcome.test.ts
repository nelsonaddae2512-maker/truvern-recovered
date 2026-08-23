import { describe, expect, it } from "vitest";

import {
  deriveCanonicalGovernanceOutcome,
} from "@/lib/governance/intelligence/governance-intelligence-engine";

describe("canonical governance outcome", () => {
  it("blocks release for a medium remediation finding", () => {
    const result =
      deriveCanonicalGovernanceOutcome({
        baseRiskLevel: "MEDIUM",
        findings: [
          {
            title:
              "Security Policy Review Governance Gap",
            severity: "MEDIUM",
            remediationRequired: true,
            requiredEvidence: [
              "Current security policy set",
            ],
            requiredAttestation: [
              "Security policy owner attestation",
            ],
          },
        ],
      });

    expect(result.riskLevel).toBe("MEDIUM");
    expect(result.recommendation).toBe(
      "REMEDIATION_REQUIRED",
    );
    expect(result.releaseReady).toBe(false);

    expect(result.followUps).toContain(
      "Remediation required: Security Policy Review Governance Gap",
    );

    expect(result.followUps).toContain(
      "Evidence required: Security Policy Review Governance Gap",
    );

    expect(result.followUps).toContain(
      "Attestation required: Security Policy Review Governance Gap",
    );
  });

  it("escalates a critical finding and blocks release", () => {
    const result =
      deriveCanonicalGovernanceOutcome({
        baseRiskLevel: "LOW",
        findings: [
          {
            title:
              "Critical access-control failure",
            severity: "CRITICAL",
            remediationRequired: true,
          },
        ],
      });

    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.recommendation).toBe(
      "NOT_RECOMMENDED",
    );
    expect(result.releaseReady).toBe(false);
  });

  it("keeps attestation-only findings conditional", () => {
    const result =
      deriveCanonicalGovernanceOutcome({
        baseRiskLevel: "LOW",
        findings: [
          {
            title: "Annual certification",
            severity: "LOW",
            remediationRequired: false,
            attestationRequired: true,
          },
        ],
      });

    expect(result.recommendation).toBe(
      "APPROVED_WITH_CONDITIONS",
    );
    expect(result.releaseReady).toBe(false);
  });

  it("permits release readiness when nothing blocks the outcome", () => {
    const result =
      deriveCanonicalGovernanceOutcome({
        baseRiskLevel: "LOW",
        findings: [],
      });

    expect(result.riskLevel).toBe("LOW");
    expect(result.recommendation).toBe(
      "APPROVED",
    );
    expect(result.releaseReady).toBe(true);
    expect(result.followUps).toEqual([]);
  });
});