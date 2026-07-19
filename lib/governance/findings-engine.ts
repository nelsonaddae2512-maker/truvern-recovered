import { scoreAssessment, type TruvernAssessmentScore, type TruvernScoringInput } from "./scoring-engine";

export type TruvernGeneratedFinding = {
  controlKey: string;
  controlCode: string | null;
  family: string | null;
  severity: "INFO" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  recommendation: string;
  remediationRequired: boolean;
  attestationRequired: boolean;
  evidenceRequired: boolean;
  dueInDays: number;
  metadata: Record<string, unknown>;
};

export type TruvernFindingsResult = {
  score: TruvernAssessmentScore;
  findings: TruvernGeneratedFinding[];
  remediationRequired: boolean;
  attestationRequired: boolean;
};

function severityFromControlPercent(percent: number): TruvernGeneratedFinding["severity"] {
  if (percent < 35) return "CRITICAL";
  if (percent < 55) return "HIGH";
  if (percent < 75) return "MODERATE";
  if (percent < 90) return "LOW";
  return "INFO";
}

function dueDaysForSeverity(severity: TruvernGeneratedFinding["severity"]): number {
  if (severity === "CRITICAL") return 7;
  if (severity === "HIGH") return 14;
  if (severity === "MODERATE") return 30;
  if (severity === "LOW") return 60;
  return 90;
}

function labelControl(controlCode: string | null, family: string | null, fallback: string): string {
  const parts = [controlCode, family].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

export function generateFindings(items: TruvernScoringInput[]): TruvernFindingsResult {
  const score = scoreAssessment(items);
  const findings: TruvernGeneratedFinding[] = [];

  for (const control of score.controls) {
    const severity = severityFromControlPercent(control.percent);
    const label = labelControl(control.controlCode, control.family, control.controlKey);

    if (control.percent < 90) {
      findings.push({
        controlKey: control.controlKey,
        controlCode: control.controlCode,
        family: control.family,
        severity,
        title: `${label} control gap detected`,
        description: `This control scored ${control.percent}% based on ${control.answeredQuestions}/${control.totalQuestions} answered questions.`,
        recommendation:
          severity === "CRITICAL" || severity === "HIGH"
            ? "Request remediation evidence from the vendor and require reviewer validation before release."
            : "Request clarification or compensating evidence before final governance release.",
        remediationRequired: severity === "CRITICAL" || severity === "HIGH" || severity === "MODERATE",
        attestationRequired: control.requiresAttestation || severity === "CRITICAL",
        evidenceRequired: control.missingEvidence > 0,
        dueInDays: dueDaysForSeverity(severity),
        metadata: {
          controlPercent: control.percent,
          controlScore: control.score,
          controlMaxScore: control.maxScore,
          answeredQuestions: control.answeredQuestions,
          totalQuestions: control.totalQuestions,
          missingEvidence: control.missingEvidence,
        },
      });
    }

    if (control.missingEvidence > 0) {
      findings.push({
        controlKey: control.controlKey,
        controlCode: control.controlCode,
        family: control.family,
        severity: control.percent < 75 ? "HIGH" : "MODERATE",
        title: `${label} evidence missing`,
        description: `${control.missingEvidence} required evidence item(s) are missing for this control.`,
        recommendation:
          "Request supporting documentation, certification, screenshot, policy, report, or signed attestation from the vendor.",
        remediationRequired: true,
        attestationRequired: control.requiresAttestation,
        evidenceRequired: true,
        dueInDays: control.percent < 75 ? 14 : 30,
        metadata: {
          missingEvidence: control.missingEvidence,
          controlPercent: control.percent,
        },
      });
    }

    if (control.requiresAttestation && control.percent < 100) {
      findings.push({
        controlKey: control.controlKey,
        controlCode: control.controlCode,
        family: control.family,
        severity: control.percent < 75 ? "HIGH" : "MODERATE",
        title: `${label} attestation required`,
        description:
          "This control requires a vendor attestation because the response is incomplete, high-impact, or requires formal certification.",
        recommendation:
          "Send an attestation request to the vendor and require reviewer acceptance before final release.",
        remediationRequired: control.percent < 75,
        attestationRequired: true,
        evidenceRequired: false,
        dueInDays: control.percent < 75 ? 14 : 30,
        metadata: {
          controlPercent: control.percent,
          requiresAttestation: true,
        },
      });
    }
  }

  const deduped = new Map<string, TruvernGeneratedFinding>();

  for (const finding of findings) {
    const key = [
      finding.controlKey,
      finding.title,
      finding.severity,
      finding.evidenceRequired,
      finding.attestationRequired,
    ].join(":");

    if (!deduped.has(key)) {
      deduped.set(key, finding);
    }
  }

  const finalFindings = Array.from(deduped.values());

  return {
    score,
    findings: finalFindings,
    remediationRequired: finalFindings.some((finding) => finding.remediationRequired),
    attestationRequired: finalFindings.some((finding) => finding.attestationRequired),
  };
}

export function shouldRequestRemediation(result: TruvernFindingsResult): boolean {
  return result.remediationRequired || result.score.riskLevel === "HIGH" || result.score.riskLevel === "CRITICAL";
}

export function shouldRequestAttestation(result: TruvernFindingsResult): boolean {
  return result.attestationRequired || result.findings.some((finding) => finding.severity === "CRITICAL");
}

