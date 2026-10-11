import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type CommercialCanaryClient = Pick<
  Prisma.TransactionClient,
  | "organization"
  | "assessment"
  | "reviewRequest"
  | "truvernCreditLedgerEntry"
  | "communicationConversation"
>;

export async function readCommercialCanaryOrganization<
  T extends Prisma.OrganizationFindFirstArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.OrganizationFindFirstArgs>,
  client: CommercialCanaryClient = prisma,
): Promise<Prisma.OrganizationGetPayload<T> | null> {
  return client.organization.findFirst(args);
}

export async function readCommercialCanaryAssessments<
  T extends Prisma.AssessmentFindManyArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.AssessmentFindManyArgs>,
  client: CommercialCanaryClient = prisma,
): Promise<Prisma.AssessmentGetPayload<T>[]> {
  return client.assessment.findMany(args);
}

export async function readCommercialCanaryReviewRequests<
  T extends Prisma.ReviewRequestFindManyArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.ReviewRequestFindManyArgs>,
  client: CommercialCanaryClient = prisma,
): Promise<Prisma.ReviewRequestGetPayload<T>[]> {
  return client.reviewRequest.findMany(args);
}

export async function readCommercialCanaryLedgerEvents<
  T extends Prisma.TruvernCreditLedgerEntryFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernCreditLedgerEntryFindManyArgs
  >,
  client: CommercialCanaryClient = prisma,
): Promise<Prisma.TruvernCreditLedgerEntryGetPayload<T>[]> {
  return client.truvernCreditLedgerEntry.findMany(args);
}

export async function readCommercialCanaryConversations<
  T extends Prisma.CommunicationConversationFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.CommunicationConversationFindManyArgs
  >,
  client: CommercialCanaryClient = prisma,
): Promise<Prisma.CommunicationConversationGetPayload<T>[]> {
  return client.communicationConversation.findMany(args);
}