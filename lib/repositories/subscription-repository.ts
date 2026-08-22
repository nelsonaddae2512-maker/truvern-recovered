import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

type SubscriptionClient = Pick<
  Prisma.TransactionClient,
  "subscription" | "billingPlan" | "organization"
>;

export async function findSubscriptionOrganizationById(
  organizationId: number,
  client: SubscriptionClient = prisma,
) {
  return client.organization.findUnique({
    where: {
      id: organizationId,
    },
    select: {
      id: true,
      name: true,
    },
  });
}
export async function findBillingPlanByTier(
  tier: "PRO" | "ENTERPRISE",
  client: SubscriptionClient = prisma,
) {
  return client.billingPlan.findUnique({
    where: {
      tier,
    },
    select: {
      id: true,
      tier: true,
      name: true,
      description: true,
      stripePriceId: true,
      maxVendors: true,
      maxMembers: true,
    },
  });
}

export async function findOrganizationSubscriptions(
  organizationId: number,
  client: SubscriptionClient = prisma,
) {
  return client.subscription.findMany({
    where: {
      organizationId,
    },
    select: {
      id: true,
      organizationId: true,
      planId: true,
      status: true,

      paymentSource: true,
      startsAt: true,
      currentPeriodEnd: true,
      paidAt: true,
      paymentReference: true,
      amountCents: true,
      currency: true,
      createdByUserId: true,
      notes: true,

      stripeSubId: true,
      stripeCustomerId: true,

      createdAt: true,
      updatedAt: true,

      plan: {
        select: {
          id: true,
          tier: true,
          name: true,
          description: true,
          stripePriceId: true,
          maxVendors: true,
          maxMembers: true,
        },
      },
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
  });
}

export async function findSubscriptionById(
  subscriptionId: number,
  client: SubscriptionClient = prisma,
) {
  return client.subscription.findUnique({
    where: {
      id: subscriptionId,
    },
    include: {
      plan: true,
    },
  });
}

export async function findLatestOrganizationSubscription(
  organizationId: number,
  client: SubscriptionClient = prisma,
) {
  return client.subscription.findFirst({
    where: {
      organizationId,
    },
    include: {
      plan: true,
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
  });
}

export async function createSubscription<
  T extends Prisma.SubscriptionCreateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.SubscriptionCreateArgs
  >,
  client: SubscriptionClient = prisma,
): Promise<Prisma.SubscriptionGetPayload<T>> {
  return client.subscription.create(args);
}

export async function updateSubscription<
  T extends Prisma.SubscriptionUpdateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.SubscriptionUpdateArgs
  >,
  client: SubscriptionClient = prisma,
): Promise<Prisma.SubscriptionGetPayload<T>> {
  return client.subscription.update(args);
}

export async function updateOrganizationSubscriptions(
  args: Prisma.SubscriptionUpdateManyArgs,
  client: SubscriptionClient = prisma,
) {
  return client.subscription.updateMany(args);
}
