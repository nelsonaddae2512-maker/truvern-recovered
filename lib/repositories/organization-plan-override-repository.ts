import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type OrganizationPlanOverrideClient = Pick<
  Prisma.TransactionClient,
  "organizationPlanOverride"
>;

export async function updateOrganizationPlanOverrides(
  args: Prisma.OrganizationPlanOverrideUpdateManyArgs,
  client: OrganizationPlanOverrideClient = prisma,
) {
  return client.organizationPlanOverride.updateMany(args);
}

export async function createOrganizationPlanOverride<
  T extends Prisma.OrganizationPlanOverrideCreateArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.OrganizationPlanOverrideCreateArgs>,
  client: OrganizationPlanOverrideClient = prisma,
): Promise<Prisma.OrganizationPlanOverrideGetPayload<T>> {
  return client.organizationPlanOverride.create(args);
}
