import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type CommercialCanaryLaunchClient = Pick<
  Prisma.TransactionClient,
  | "organization"
  | "assessment"
  | "reviewAssignment"
>;

export async function readCommercialCanaryLaunchOrganization<
  T extends Prisma.OrganizationFindUniqueArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.OrganizationFindUniqueArgs
  >,
  client: CommercialCanaryLaunchClient = prisma,
): Promise<Prisma.OrganizationGetPayload<T> | null> {
  return client.organization.findUnique(args);
}

export async function countCommercialCanaryLaunchAssessments(
  args: Prisma.AssessmentCountArgs,
  client: CommercialCanaryLaunchClient = prisma,
): Promise<number> {
  return client.assessment.count(args);
}

export async function countCommercialCanaryLaunchAssignments(
  args: Prisma.ReviewAssignmentCountArgs,
  client: CommercialCanaryLaunchClient = prisma,
): Promise<number> {
  return client.reviewAssignment.count(args);
}