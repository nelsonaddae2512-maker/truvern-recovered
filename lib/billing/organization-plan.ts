import prisma from "@/lib/prisma";

export type OrganizationPlanTier = "FREE" | "PRO" | "ENTERPRISE";

type PlanRow = {
  planTier: string | null;
};

export function normalizeOrganizationPlanTier(value: unknown): OrganizationPlanTier {
  const normalized = String(value || "").toUpperCase();

  if (normalized === "PRO") return "PRO";
  if (normalized === "ENTERPRISE") return "ENTERPRISE";

  return "FREE";
}

async function readOrganizationBasePlanTier(
  organizationId: number,
): Promise<OrganizationPlanTier> {
  try {
    const rows = await prisma.$queryRaw<PlanRow[]>`
      SELECT "planTier" as "planTier"
      FROM "Organization"
      WHERE "id" = ${organizationId}
      LIMIT 1
    `;

    return normalizeOrganizationPlanTier(rows[0]?.planTier);
  } catch {
    return "FREE";
  }
}

export async function resolveOrganizationPlanTier(
  organizationId: number,
): Promise<OrganizationPlanTier> {
  const now = new Date();

  const override = await prisma.organizationPlanOverride.findFirst({
    where: {
      organizationId,
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      planTier: true,
    },
  });

  if (override) {
    return normalizeOrganizationPlanTier(override.planTier);
  }

  return readOrganizationBasePlanTier(organizationId);
}

