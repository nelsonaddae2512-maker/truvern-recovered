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

function recommendationFor(result: TruvernFindingsResult): GovernanceRecommendation {
  const critical = result.findings.filter((f) => f.severity === "CRITICAL").length;
  const high = result.findings.filter((f) => f.severity === "HIGH").length;

  if (result.score.riskLevel === "CRITICAL" || critical > 0) return "NOT_RECOMMENDED";
  if (result.score.riskLevel === "HIGH" || high >= 3) return "HIGH_RISK";
  if (shouldRequestRemediation(result)) return "REMEDIATION_REQUIRED";
  if (shouldRequestAttestation(result) || result.findings.length > 0) return "APPROVED_WITH_CONDITIONS";

  return "APPROVED";
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
