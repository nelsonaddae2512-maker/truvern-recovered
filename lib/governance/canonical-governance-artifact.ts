export type CanonicalGovernanceArtifact = {
  schema: "truvern.canonical_governance_artifact.v1";
  generatedAt: string;
  executiveSummary: string;
  finalAssessment: string;
  finalRecommendation: string;
  decision: string | null;
  riskLevel: string | null;
  findings: unknown[];
  conditionsAndFollowUps: string[];
  boardSummary: string;
  customerSummary: string;
};

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^not recorded\.?$/i.test(text)) return "";
  return text;
}

export function cleanGovernanceConditions(values: unknown[]) {
  const seen = new Set<string>();

  return values
    .map((value) =>
      cleanText(value)
        .replace(/^Remediation:\s*/i, "")
        .replace(/^Follow-up:\s*/i, "")
        .replace(/^Condition:\s*/i, "")
        .replace(/^[•\-–—*]\s*/i, "")
        .trim(),
    )
    .filter((line) => {
      if (!line) return false;

      const lower = line.toLowerCase();

      if (lower === "executive summary") return false;
      if (lower === "final assessment") return false;
      if (lower === "conditions & follow-ups") return false;
      if (lower.includes("submitted questionnaire answers reviewed")) return false;
      if (lower.includes("this assessment was reviewed through truvern governance workflows")) return false;
      if (lower.includes("based on the available assessment information")) return false;
      if (lower.includes("this assessment outcome is prepared")) return false;

      if (seen.has(lower)) return false;
      seen.add(lower);

      return true;
    });
}

export function buildCanonicalGovernanceArtifact(input: {
  executiveSummary: unknown;
  finalAssessment: unknown;
  finalRecommendation?: unknown;
  decision?: unknown;
  riskLevel?: unknown;
  findings?: unknown[];
  conditionsAndFollowUps?: unknown[];
  boardSummary?: unknown;
  customerSummary?: unknown;
}): CanonicalGovernanceArtifact {
  const executiveSummary = cleanText(input.executiveSummary);
  const finalAssessment = cleanText(input.finalAssessment);
  const finalRecommendation =
    cleanText(input.finalRecommendation) || finalAssessment;

  return {
    schema: "truvern.canonical_governance_artifact.v1",
    generatedAt: new Date().toISOString(),
    executiveSummary,
    finalAssessment,
    finalRecommendation,
    decision: cleanText(input.decision) || null,
    riskLevel: cleanText(input.riskLevel) || null,
    findings: Array.isArray(input.findings) ? input.findings : [],
    conditionsAndFollowUps: cleanGovernanceConditions(
      Array.isArray(input.conditionsAndFollowUps)
        ? input.conditionsAndFollowUps
        : [],
    ),
    boardSummary: cleanText(input.boardSummary) || executiveSummary,
    customerSummary: cleanText(input.customerSummary) || finalAssessment,
  };
}
