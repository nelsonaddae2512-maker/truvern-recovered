import { requireDbOrganization } from "@/lib/org-db";
import {
  normalizeOrganizationPlanTier,
  resolveOrganizationPlanTier,
  type OrganizationPlanTier,
} from "@/lib/billing/organization-plan";

export type TruvernPlan = OrganizationPlanTier;

export type PlanEntitlements = {
  plan: TruvernPlan;
  isFree: boolean;
  isPro: boolean;
  isEnterprise: boolean;
  canUseAdvancedReviewDesk: boolean;
  canUseGovernanceIntegrity: boolean;
  canUseBoardReadyExports: boolean;
  canUseGovernanceExports: boolean;
  canUseImmutableReleases: boolean;
  canUseAttestations: boolean;
  canUseExecutiveAttestations: boolean;
  canUseIndependentVerification: boolean;
  canUseEnterpriseControls: boolean;
};

export async function getCurrentPlanEntitlements(): Promise<PlanEntitlements> {
  const org = await requireDbOrganization().catch(() => null);

  if (!org || !("id" in org) || !org.id) {
    return planEntitlements("FREE");
  }

  const plan = await resolveOrganizationPlanTier(Number(org.id));

  return planEntitlements(plan);
}

export function planEntitlements(plan: unknown): PlanEntitlements {
  const normalized = normalizeOrganizationPlanTier(plan);

  const isEnterprise = normalized === "ENTERPRISE";
  const isPro = normalized === "PRO" || isEnterprise;
  const isFree = normalized === "FREE";

  return {
    plan: normalized,
    isFree,
    isPro,
    isEnterprise,
    canUseAdvancedReviewDesk: isPro,
    canUseGovernanceIntegrity: isPro,
    canUseBoardReadyExports: isPro,
    canUseGovernanceExports: isPro,
    canUseImmutableReleases: isPro,
    canUseAttestations: isEnterprise,
    canUseExecutiveAttestations: isEnterprise,
    canUseIndependentVerification: isEnterprise,
    canUseEnterpriseControls: isEnterprise,
  };
}


