export const TRUVERN_NIST_800_53_TEMPLATE_NAME =
  "Truvern NIST 800-53 Governance Review";

export function isTruvernNist80053Template(template: {
  name?: string | null;
  catalogKey?: string | null;
  accessTier?: string | null;
}) {
  return (
    template.name === TRUVERN_NIST_800_53_TEMPLATE_NAME ||
    template.catalogKey === "truvern-nist-800-53-governance-review"
  );
}

export function canLaunchGovernanceTemplate(
  template: {
    name?: string | null;
    catalogKey?: string | null;
    accessTier?: string | null;
  },
  tier: string | null | undefined,
) {
  const normalizedTier = String(tier ?? "FREE").toUpperCase();

  if (!isTruvernNist80053Template(template)) {
    return true;
  }

  return normalizedTier === "PRO" || normalizedTier === "ENTERPRISE";
}

export function governanceTemplateGateMessage() {
  return "Pro or Enterprise membership is required to launch the Truvern NIST 800-53 Governance Review. Free users can preview the template and view questionnaires sent by Truvern Review, but cannot launch this governance template themselves.";
}
