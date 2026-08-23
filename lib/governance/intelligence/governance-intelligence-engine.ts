import {
  generateFindings,
  shouldRequestAttestation,
  shouldRequestRemediation,
  type TruvernFindingsResult,
} from "@/lib/governance/findings-engine";
import type { TruvernScoringInput } from "@/lib/governance/scoring-engine";

export type GovernanceIntelligenceInput = {
  assessmentId?: number | null;
  vendorName?: string | null;
  frameworkName?: string | null;
  responses: TruvernScoringInput[];
};

export type GovernanceRecommendation =
  | "APPROVED"
  | "APPROVED_WITH_CONDITIONS"
  | "REMEDIATION_REQUIRED"
  | "HIGH_RISK"
  | "NOT_RECOMMENDED";

export type GovernanceIntelligenceResult = {
  version: "TRV-GOV-INTEL-1.0";
  generatedAt: string;
  assessmentId: number | null;
  vendorName: string;
  frameworkName: string;
  score: TruvernFindingsResult["score"];
  findings: TruvernFindingsResult["findings"];
  remediationRequired: boolean;
  attestationRequired: boolean;
  recommendation: GovernanceRecommendation;
  executiveSummary: string;
  finalRecommendation: string;
  followUps: string[];
  metrics: {
    totalResponses: number;
    completedQuestions: number;
    missingEvidence: number;
    criticalFindings: number;
    highFindings: number;
    moderateFindings: number;
  };
};

export type CanonicalGovernanceFindingInput = {
  title?: string | null;
  severity?: string | null;
  remediationRequired?: boolean | null;
  attestationRequired?: boolean | null;
  requiredEvidence?: unknown;
  requiredAttestation?: unknown;
};

export type CanonicalGovernanceOutcome = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendation: GovernanceRecommendation;
  releaseReady: boolean;
  followUps: string[];
  findingCount: number;
  remediationRequired: boolean;
  attestationRequired: boolean;
};

function normalizeCanonicalRiskLevel(
  value: unknown,
): CanonicalGovernanceOutcome["riskLevel"] {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  if (normalized === "CRITICAL") return "CRITICAL";
  if (normalized === "HIGH") return "HIGH";

  if (
    normalized === "MEDIUM" ||
    normalized === "MODERATE"
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

function canonicalRiskRank(
  value: CanonicalGovernanceOutcome["riskLevel"],
) {
  if (value === "CRITICAL") return 4;
  if (value === "HIGH") return 3;
  if (value === "MEDIUM") return 2;
  return 1;
}

export function deriveCanonicalGovernanceOutcome(input: {
  baseRiskLevel?: unknown;
  findings?: CanonicalGovernanceFindingInput[] | null;
}): CanonicalGovernanceOutcome {
  const findings =
    Array.isArray(input.findings)
      ? input.findings
      : [];

  const baseRiskLevel =
    normalizeCanonicalRiskLevel(
      input.baseRiskLevel,
    );

  let riskLevel = baseRiskLevel;

  for (const finding of findings) {
    const findingRisk =
      normalizeCanonicalRiskLevel(
        finding?.severity,
      );

    if (
      canonicalRiskRank(findingRisk) >
      canonicalRiskRank(riskLevel)
    ) {
      riskLevel = findingRisk;
    }
  }

  const criticalCount =
    findings.filter(
      (finding) =>
        normalizeCanonicalRiskLevel(
          finding?.severity,
        ) === "CRITICAL",
    ).length;

  const highCount =
    findings.filter(
      (finding) =>
        normalizeCanonicalRiskLevel(
          finding?.severity,
        ) === "HIGH",
    ).length;

  const remediationRequired =
    findings.some(
      (finding) =>
        finding?.remediationRequired === true,
    );

  const attestationRequired =
    findings.some((finding) => {
      if (finding?.attestationRequired === true) {
        return true;
      }

      return (
        Array.isArray(
          finding?.requiredAttestation,
        ) &&
        finding.requiredAttestation.length > 0
      );
    });

  let recommendation: GovernanceRecommendation;

  if (
    riskLevel === "CRITICAL" ||
    criticalCount > 0
  ) {
    recommendation = "NOT_RECOMMENDED";
  } else if (
    baseRiskLevel === "HIGH" ||
    highCount >= 3
  ) {
    recommendation = "HIGH_RISK";
  } else if (remediationRequired) {
    recommendation = "REMEDIATION_REQUIRED";
  } else if (
    attestationRequired ||
    findings.length > 0
  ) {
    recommendation =
      "APPROVED_WITH_CONDITIONS";
  } else {
    recommendation = "APPROVED";
  }

  const followUps =
    Array.from(
      new Set(
        findings.flatMap((finding) => {
          const title =
            String(finding?.title ?? "")
              .trim() ||
            "Governance finding";

          const rows: string[] = [];

          if (
            finding?.remediationRequired === true
          ) {
            rows.push(
              `Remediation required: ${title}`,
            );
          }

          if (
            Array.isArray(
              finding?.requiredEvidence,
            ) &&
            finding.requiredEvidence.length > 0
          ) {
            rows.push(
              `Evidence required: ${title}`,
            );
          }

          if (
            finding?.attestationRequired === true ||
            (
              Array.isArray(
                finding?.requiredAttestation,
              ) &&
              finding.requiredAttestation.length > 0
            )
          ) {
            rows.push(
              `Attestation required: ${title}`,
            );
          }

          return rows;
        }),
      ),
    );

  return {
    riskLevel,
    recommendation,
    releaseReady:
      recommendation === "APPROVED",
    followUps,
    findingCount: findings.length,
    remediationRequired,
    attestationRequired,
  };
}
function recommendationFor(
  result: TruvernFindingsResult,
): GovernanceRecommendation {
  return deriveCanonicalGovernanceOutcome({
    baseRiskLevel: result.score.riskLevel,
    findings: result.findings,
  }).recommendation;
}

function labelRecommendation(value: GovernanceRecommendation) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildExecutiveSummary(input: GovernanceIntelligenceInput, result: TruvernFindingsResult) {
  const vendor = input.vendorName || "The vendor";
  const framework = input.frameworkName || "the selected governance framework";
  const critical = result.findings.filter((f) => f.severity === "CRITICAL").length;
  const high = result.findings.filter((f) => f.severity === "HIGH").length;
  const moderate = result.findings.filter((f) => f.severity === "MODERATE").length;

  return [
    `${vendor} was reviewed against ${framework}.`,
    `The assessment achieved an overall governance score of ${result.score.percent}% with a ${result.score.riskLevel} residual risk rating.`,
    `Truvern identified ${result.findings.length} governance finding(s), including ${critical} critical, ${high} high, and ${moderate} moderate finding(s).`,
    result.remediationRequired
      ? "Remediation is required before unrestricted governance release."
      : "No mandatory remediation blocker was identified by the current scoring engine.",
    result.attestationRequired
      ? "One or more attestations should be obtained or reviewed before final release."
      : "No mandatory attestation blocker was identified by the current scoring engine.",
  ].join(" ");
}

function buildFinalRecommendation(recommendation: GovernanceRecommendation, result: TruvernFindingsResult) {
  const label = labelRecommendation(recommendation);

  if (recommendation === "APPROVED") {
    return `${label}. Truvern found the current evidence and response posture sufficient for release based on the available assessment record.`;
  }

  if (recommendation === "APPROVED_WITH_CONDITIONS") {
    return `${label}. Truvern recommends release only after the listed conditions, attestations, or evidence clarifications are accepted by the reviewer.`;
  }

  if (recommendation === "REMEDIATION_REQUIRED") {
    return `${label}. Remediation should be requested and validated before final governance release.`;
  }

  if (recommendation === "HIGH_RISK") {
    return `${label}. Significant governance risk remains and should be escalated for risk-owner review before approval.`;
  }

  return `${label}. The assessment contains critical governance gaps or insufficient evidence and should not be approved without material remediation.`;
}

function buildFollowUps(result: TruvernFindingsResult) {
  const rows = result.findings.flatMap((finding) => {
    const items: string[] = [];

    if (finding.remediationRequired) {
      items.push(`Remediation required: ${finding.title}`);
    }

    if (finding.evidenceRequired) {
      items.push(`Evidence required: ${finding.title}`);
    }

    if (finding.attestationRequired) {
      items.push(`Attestation required: ${finding.title}`);
    }

    return items;
  });

  return Array.from(new Set(rows)).slice(0, 25);
}

export function runGovernanceIntelligence(
  input: GovernanceIntelligenceInput,
): GovernanceIntelligenceResult {
  const result = generateFindings(input.responses);
  const recommendation = recommendationFor(result);

  const missingEvidence = result.score.controls.reduce(
    (total, control) => total + Number(control.missingEvidence ?? 0),
    0,
  );

  return {
    version: "TRV-GOV-INTEL-1.0",
    generatedAt: new Date().toISOString(),
    assessmentId: input.assessmentId ?? null,
    vendorName: input.vendorName || "Vendor",
    frameworkName: input.frameworkName || "Governance assessment",
    score: result.score,
    findings: result.findings,
    remediationRequired: result.remediationRequired,
    attestationRequired: result.attestationRequired,
    recommendation,
    executiveSummary: buildExecutiveSummary(input, result),
    finalRecommendation: buildFinalRecommendation(recommendation, result),
    followUps: buildFollowUps(result),
    metrics: {
      totalResponses: input.responses.length,
      completedQuestions: result.score.completedQuestions,
      missingEvidence,
      criticalFindings: result.findings.filter((f) => f.severity === "CRITICAL").length,
      highFindings: result.findings.filter((f) => f.severity === "HIGH").length,
      moderateFindings: result.findings.filter((f) => f.severity === "MODERATE").length,
    },
  };
}
