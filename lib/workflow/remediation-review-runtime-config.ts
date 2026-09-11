import "server-only";

import type { OrganizationPlanTier } from "@/lib/billing/organization-plan";

export const REMEDIATION_REVIEW_RUNTIME_CONFIG_VERSION =
  "TRV-REMEDIATION-REVIEW-RUNTIME-1.0" as const;

export type RemediationReviewEligibilityReason =
  | "TRUVERN_REVIEW"
  | "PAID_PLAN"
  | "FREE_PLAN"
  | "UNSUPPORTED_ASSIGNMENT_TYPE";

export type RemediationReviewCommercialEligibility = {
  eligible: boolean;
  reason: RemediationReviewEligibilityReason;
};

export function isRemediationReviewRuntimeEnabled(): boolean {
  return (
    String(
      process.env.TRUVERN_AI_REMEDIATION_REVIEW_ENABLED ?? "",
    ).trim() === "1"
  );
}

export function getConfiguredRemediationReviewModel():
  | string
  | undefined {
  const value =
    String(
      process.env.TRUVERN_AI_REMEDIATION_REVIEW_MODEL ?? "",
    ).trim();

  return value || undefined;
}

export function getConfiguredRemediationReviewApiKey():
  | string
  | undefined {
  const value =
    String(
      process.env.OPENAI_API_KEY ?? "",
    ).trim();

  return value || undefined;
}

export function hasConfiguredRemediationReviewApiKey(): boolean {
  return Boolean(
    getConfiguredRemediationReviewApiKey(),
  );
}

export function evaluateRemediationReviewCommercialEligibility(input: {
  assignmentType: string | null | undefined;
  organizationPlanTier: OrganizationPlanTier | null;
}): RemediationReviewCommercialEligibility {
  const assignmentType =
    String(input.assignmentType ?? "")
      .trim()
      .toUpperCase();

  if (assignmentType === "TRUVERN") {
    return {
      eligible: true,
      reason: "TRUVERN_REVIEW",
    };
  }

  if (assignmentType !== "INTERNAL") {
    return {
      eligible: false,
      reason: "UNSUPPORTED_ASSIGNMENT_TYPE",
    };
  }

  if (
    input.organizationPlanTier === "PRO" ||
    input.organizationPlanTier === "ENTERPRISE"
  ) {
    return {
      eligible: true,
      reason: "PAID_PLAN",
    };
  }

  return {
    eligible: false,
    reason: "FREE_PLAN",
  };
}