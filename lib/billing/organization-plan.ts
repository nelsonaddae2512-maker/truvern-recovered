import prisma from "@/lib/prisma";

export type OrganizationPlanTier =
  | "FREE"
  | "PRO"
  | "ENTERPRISE";

export type OrganizationPlanSource =
  | "OVERRIDE"
  | "SUBSCRIPTION"
  | "FREE";

export type OrganizationPlanResolution = {
  planTier: OrganizationPlanTier;
  source: OrganizationPlanSource;
  subscriptionId: number | null;
  expiresAt: Date | null;
};

export function normalizeOrganizationPlanTier(
  value: unknown,
): OrganizationPlanTier {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  if (normalized === "PRO") {
    return "PRO";
  }

  if (normalized === "ENTERPRISE") {
    return "ENTERPRISE";
  }

  return "FREE";
}

function activeSubscriptionStatus(
  value: unknown,
): boolean {
  const status =
    String(value || "")
      .trim()
      .toUpperCase();

  return (
    status === "ACTIVE" ||
    status === "TRIALING"
  );
}

export async function resolveOrganizationPlan(
  organizationId: number,
): Promise<OrganizationPlanResolution> {
  const now = new Date();

  /*
   * 1. Explicit Truvern Ops overrides remain highest priority.
   *
   * They are intended for pilots, demos, temporary enablement,
   * contractual exceptions, or emergency access.
   */
  const override =
    await prisma.organizationPlanOverride.findFirst({
      where: {
        organizationId,
        revokedAt: null,
        startsAt: {
          lte: now,
        },
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: now,
            },
          },
        ],
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: {
        planTier: true,
        expiresAt: true,
      },
    });

  if (override) {
    return {
      planTier:
        normalizeOrganizationPlanTier(
          override.planTier,
        ),
      source: "OVERRIDE",
      subscriptionId: null,
      expiresAt: override.expiresAt,
    };
  }

  /*
   * 2. Paid subscription is the normal commercial authority.
   *
   * Payment source is deliberately irrelevant here:
   * Stripe, check, ACH, wire, invoice, and contract records
   * resolve identically once Truvern records the subscription.
   */
  const subscriptions =
    await prisma.subscription.findMany({
      where: {
        organizationId,
        startsAt: {
          lte: now,
        },
        OR: [
          {
            currentPeriodEnd: null,
          },
          {
            currentPeriodEnd: {
              gt: now,
            },
          },
        ],
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: {
        id: true,
        status: true,
        currentPeriodEnd: true,
        plan: {
          select: {
            tier: true,
          },
        },
      },
    });

  const activeSubscription =
    subscriptions.find((subscription) =>
      activeSubscriptionStatus(
        subscription.status,
      ),
    );

  if (activeSubscription) {
    const planTier =
      normalizeOrganizationPlanTier(
        activeSubscription.plan.tier,
      );

    /*
     * A subscription attached to an unknown BillingPlan must not
     * accidentally grant paid access.
     */
    if (planTier !== "FREE") {
      return {
        planTier,
        source: "SUBSCRIPTION",
        subscriptionId:
          activeSubscription.id,
        expiresAt:
          activeSubscription.currentPeriodEnd,
      };
    }
  }

  /*
   * 3. No live commercial entitlement = FREE.
   *
   * Organization.planTier is intentionally no longer authoritative
   * for paid access because that legacy field has no expiry lifecycle.
   */
  return {
    planTier: "FREE",
    source: "FREE",
    subscriptionId: null,
    expiresAt: null,
  };
}

export async function resolveOrganizationPlanTier(
  organizationId: number,
): Promise<OrganizationPlanTier> {
  const resolution =
    await resolveOrganizationPlan(
      organizationId,
    );

  return resolution.planTier;
}
