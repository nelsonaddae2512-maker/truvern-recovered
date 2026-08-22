import { requireDbOrganization } from "@/lib/org-db";
import { isTruvernOperator } from "@/lib/truvern-ops-access";
import {
  normalizeOrganizationPlanTier,
  resolveOrganizationPlanTier,
  type OrganizationPlanTier,
} from "@/lib/billing/organization-plan";

export type MembershipTier = OrganizationPlanTier;

export function normalizeTier(value: unknown): MembershipTier {
  return normalizeOrganizationPlanTier(value);
}

export async function getCurrentOrgPlanTier(): Promise<MembershipTier> {
  const org = await requireDbOrganization();

  if (!("id" in org)) {
    return "FREE";
  }

  return resolveOrganizationPlanTier(Number(org.id));
}

export function canAccessTier(
  current: MembershipTier,
  required?: string | null,
) {
  if (!required) return true;

  const need = normalizeTier(required);

  if (current === "ENTERPRISE") return true;

  if (current === "PRO") {
    return need === "FREE" || need === "PRO";
  }

  return need === "FREE";
}

export async function canUseCommunications(
  plan?: MembershipTier,
): Promise<boolean> {
  const operator = await isTruvernOperator();

  if (operator) {
    return true;
  }

  const currentPlan = plan ?? (await getCurrentOrgPlanTier());

  return currentPlan === "PRO" || currentPlan === "ENTERPRISE";
}
