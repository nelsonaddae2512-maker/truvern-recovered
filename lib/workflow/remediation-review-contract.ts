export const REMEDIATION_REVIEW_CONTRACT_VERSION =
  "TRV-REMEDIATION-REVIEW-1.0" as const;

export type RemediationEvidenceContextStatus =
  | "NOT_AVAILABLE"
  | "TEXT_AVAILABLE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "EMPTY_TEXT"
  | "READ_FAILED";

export type RemediationReviewRecommendation =
  | "REMEDIATION_APPEARS_SUFFICIENT"
  | "MORE_INFORMATION_NEEDED"
  | "REMEDIATION_APPEARS_INSUFFICIENT"
  | "HUMAN_REVIEW_REQUIRED";

export type RemediationEvidenceSufficiency =
  | "SUFFICIENT"
  | "PARTIAL"
  | "INSUFFICIENT"
  | "NOT_ASSESSABLE";

export type RemediationRequirementCoverage =
  | "COVERED"
  | "PARTIALLY_COVERED"
  | "NOT_COVERED"
  | "NOT_ASSESSABLE";

export type RemediationReviewEvidenceContext = {
  status: RemediationEvidenceContextStatus;
  contentType: string | null;
  contentLength: number | null;
  text: string | null;
  reason: string | null;
};

export type RemediationReviewInput = {
  contractVersion: typeof REMEDIATION_REVIEW_CONTRACT_VERSION;

  taskId: number;
  packageId: number;
  workflowId: number;
  queueItemId: number | null;

  reviewAssignmentId: number;
  vendorId: number;
  organizationId: number;

  sourceKey: string | null;
  severity: string | null;

  questionPrompt: string | null;
  title: string | null;
  summary: string | null;

  requiredEvidence: unknown[];
  requiredAttestations: unknown[];

  remediationRecommendation: string | null;
  releaseImpact: string | null;
  evidenceSignal: string | null;

  evidenceRequestId: number | null;
  fulfilledEvidenceId: number | null;

  evidenceRequestTitle: string | null;
  evidenceRequestDescription: string | null;
  vendorResponse: string | null;
  reviewerNotes: string | null;
  resolutionNotes: string | null;

  evidenceId: number | null;
  evidenceTitle: string | null;
  evidenceDescription: string | null;
  evidenceStorageKey: string | null;
  evidenceKind: string | null;
  evidenceUploadedAt: Date | string | null;
  evidenceDocumentDate: Date | string | null;
  evidenceValidUntil: Date | string | null;

  evidenceContext: RemediationReviewEvidenceContext;
};

export type RemediationReviewResult = {
  contractVersion: typeof REMEDIATION_REVIEW_CONTRACT_VERSION;

  recommendation: RemediationReviewRecommendation;
  confidence: number;

  evidenceSufficiency: RemediationEvidenceSufficiency;
  requirementCoverage: RemediationRequirementCoverage;

  identifiedGaps: string[];
  residualConcerns: string[];
  suggestedReviewerFocus: string[];

  rationale: string;

  requiresHumanReview: true;
};

export function createRemediationReviewInput(
  input: Omit<
    RemediationReviewInput,
    "contractVersion"
  >,
): RemediationReviewInput {
  return {
    ...input,
    contractVersion:
      REMEDIATION_REVIEW_CONTRACT_VERSION,
  };
}

export function createHumanReviewRequiredResult(
  input: {
    rationale: string;
    confidence?: number;
    evidenceSufficiency?: RemediationEvidenceSufficiency;
    requirementCoverage?: RemediationRequirementCoverage;
    identifiedGaps?: string[];
    residualConcerns?: string[];
    suggestedReviewerFocus?: string[];
  },
): RemediationReviewResult {
  const confidence =
    typeof input.confidence === "number" &&
    Number.isFinite(input.confidence)
      ? Math.min(1, Math.max(0, input.confidence))
      : 0;

  return {
    contractVersion:
      REMEDIATION_REVIEW_CONTRACT_VERSION,
    recommendation:
      "HUMAN_REVIEW_REQUIRED",
    confidence,
    evidenceSufficiency:
      input.evidenceSufficiency ??
      "NOT_ASSESSABLE",
    requirementCoverage:
      input.requirementCoverage ??
      "NOT_ASSESSABLE",
    identifiedGaps:
      input.identifiedGaps ?? [],
    residualConcerns:
      input.residualConcerns ?? [],
    suggestedReviewerFocus:
      input.suggestedReviewerFocus ?? [],
    rationale:
      input.rationale,
    requiresHumanReview:
      true,
  };
}
