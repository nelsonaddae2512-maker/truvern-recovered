import crypto from "crypto";

export type ImmutableReleaseSnapshotInput = {
  assignmentId: number;
  reviewResponseId: number | null;
  vendorName?: string | null;
  organizationId?: number | null;
  reviewer?: string | null;
  responses: any;
};

export function stableJson(value: any): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeys);

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = sortKeys(value[key]);
        return acc;
      }, {});
  }

  return value;
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildImmutableReleaseSnapshot(input: ImmutableReleaseSnapshotInput) {
  const releasedAt = new Date().toISOString();

  const snapshot = {
    schema: "TRV-IMMUTABLE-GOVERNANCE-RELEASE-1.0",
    releaseId: crypto.randomUUID(),
    releasedAt,
    assignmentId: input.assignmentId,
    reviewResponseId: input.reviewResponseId,
    vendorName: input.vendorName || "Vendor",
    organizationId: input.organizationId ?? null,
    reviewer: input.reviewer || "Truvern Reviewer",

    executiveSummary:
      input.responses?.executiveSummary ||
      input.responses?.structuredAssessment?.executiveSummary ||
      input.responses?.truvernReviewerIntelligence?.executiveSummary ||
      null,

    finalAssessment:
      input.responses?.finalAssessment ||
      input.responses?.structuredAssessment?.finalAssessment ||
      input.responses?.truvernReviewerIntelligence?.finalAssessment ||
      input.responses?.truvernReviewerIntelligence?.finalRecommendation ||
      input.responses?.finalRecommendation ||
      null,

    finalRecommendation:
      input.responses?.finalRecommendation ||
      input.responses?.structuredAssessment?.riskAnalysis?.governanceDecision ||
      input.responses?.truvernReviewerIntelligence?.recommendation ||
      null,

    riskLevel:
      input.responses?.riskLevel ||
      input.responses?.structuredAssessment?.riskAnalysis?.residualRisk ||
      input.responses?.truvernReviewerIntelligence?.score?.riskLevel ||
      null,

    findings:
      input.responses?.responseDrivenFindingsV2 ||
      input.responses?.findings ||
      input.responses?.truvernReviewerIntelligence?.findings ||
      [],

    remediation:
      input.responses?.truvernRemediation || null,

    conditionsAndFollowUps:
      input.responses?.conditionsAndFollowUps ||
      input.responses?.truvernRemediation?.reviewerConditions ||
      [],

    attestationRequests:
      input.responses?.attestationRequests ||
      input.responses?.truvernRemediation?.attestationRequests ||
      [],

    evidenceReviewed:
      input.responses?.structuredAssessment?.evidenceReviewed ||
      input.responses?.evidenceManifest?.items ||
      [],

    questionnaireReview:
      input.responses?.structuredAssessment?.questionnaireReview || null,

    sourceResponsesChecksum: sha256(stableJson(input.responses || {})),
  };

  const canonical = stableJson(snapshot);
  const checksum = sha256(canonical);

  return {
    ...snapshot,
    checksum,
    governanceSeal: {
      schema: "TRV-GOVERNANCE-SEAL-1.0",
      sealedAt: releasedAt,
      releaseId: snapshot.releaseId,
      checksum,
      algorithm: "SHA-256",
      immutable: true,
    },
  };
}

