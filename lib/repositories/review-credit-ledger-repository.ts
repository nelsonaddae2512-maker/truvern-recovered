import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export type ReviewCreditTransaction =
  Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0];

export type ReviewCreditBalance = {
  reservedCredits: number;
  consumedCredits: number;
};

export type InsertReviewCreditLedgerEntryInput = {
  organizationId: number;
  assignmentId: number;
  reviewRequestId: number | null;
  vendorId: number;
  eventKey: string;
  quantity: number;
  note: string;
  metadataJson: string;
};

export async function getAvailableReviewCredits(
  tx: ReviewCreditTransaction,
  organizationId: number,
): Promise<number> {
  const result =
    await tx.truvernCreditLedgerEntry.aggregate({
      where: {
        organizationId,
        status: "POSTED",
      },
      _sum: {
        availableDelta: true,
      },
    });

  return Number(
    result._sum.availableDelta ?? 0,
  );
}

export async function getReviewCreditBalance(
  tx: ReviewCreditTransaction,
  input: {
    organizationId: number;
    assignmentId: number;
  },
): Promise<ReviewCreditBalance> {
  const result =
    await tx.truvernCreditLedgerEntry.aggregate({
      where: {
        organizationId: input.organizationId,
        reviewAssignmentId: input.assignmentId,
        status: "POSTED",
      },
      _sum: {
        reservedDelta: true,
        consumedDelta: true,
      },
    });

  return {
    reservedCredits: Number(
      result._sum.reservedDelta ?? 0,
    ),
    consumedCredits: Number(
      result._sum.consumedDelta ?? 0,
    ),
  };
}

export async function reviewCreditEventExists(
  tx: ReviewCreditTransaction,
  eventKey: string,
): Promise<boolean> {
  const existing =
    await tx.truvernCreditLedgerEntry.findFirst({
      where: {
        eventKey,
        status: "POSTED",
      },
      select: {
        id: true,
      },
    });

  return existing !== null;
}

export async function insertReviewCreditReservation(
  tx: ReviewCreditTransaction,
  input: InsertReviewCreditLedgerEntryInput,
): Promise<void> {
  const existing =
    await tx.truvernCreditLedgerEntry.findFirst({
      where: {
        eventKey: input.eventKey,
      },
      select: {
        id: true,
      },
    });

  if (existing) {
    return;
  }

  await tx.truvernCreditLedgerEntry.create({
    data: {
      organizationId: input.organizationId,
      reviewAssignmentId: input.assignmentId,
      reviewRequestId: input.reviewRequestId,
      vendorId: input.vendorId,
      eventKey: input.eventKey,
      entryType: "RESERVATION",
      fundingSource: "PREPAID_CREDITS",
      status: "POSTED",
      availableDelta: -input.quantity,
      reservedDelta: input.quantity,
      consumedDelta: 0,
      quantity: input.quantity,
      note: input.note,
      metadataJson: JSON.parse(input.metadataJson),
      createdAt: new Date(),
    },
  });
}

export async function insertReviewCreditReversal(
  tx: ReviewCreditTransaction,
  input: InsertReviewCreditLedgerEntryInput,
): Promise<void> {
  const existing =
    await tx.truvernCreditLedgerEntry.findFirst({
      where: {
        eventKey: input.eventKey,
      },
      select: {
        id: true,
      },
    });

  if (existing) {
    return;
  }

  await tx.truvernCreditLedgerEntry.create({
    data: {
      organizationId: input.organizationId,
      reviewAssignmentId: input.assignmentId,
      reviewRequestId: input.reviewRequestId,
      vendorId: input.vendorId,
      eventKey: input.eventKey,
      entryType: "REVERSAL",
      fundingSource: "PREPAID_CREDITS",
      status: "POSTED",
      availableDelta: input.quantity,
      reservedDelta: -input.quantity,
      consumedDelta: 0,
      quantity: input.quantity,
      note: input.note,
      metadataJson: JSON.parse(input.metadataJson),
      createdAt: new Date(),
    },
  });
}
export async function aggregateTruvernCreditLedger<
  T extends Prisma.TruvernCreditLedgerEntryAggregateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernCreditLedgerEntryAggregateArgs
  >,
  client: ReviewCreditTransaction | typeof prisma = prisma,
) {
  return client.truvernCreditLedgerEntry.aggregate(args);
}
export async function findFirstTruvernCreditLedgerEntry<
  T extends Prisma.TruvernCreditLedgerEntryFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernCreditLedgerEntryFindFirstArgs
  >,
  client: ReviewCreditTransaction | typeof prisma = prisma,
): Promise<
  Prisma.TruvernCreditLedgerEntryGetPayload<T> | null
> {
  return client.truvernCreditLedgerEntry.findFirst(args);
}
export async function createTruvernCreditLedgerEntry<
  T extends Prisma.TruvernCreditLedgerEntryCreateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernCreditLedgerEntryCreateArgs
  >,
  client: ReviewCreditTransaction | typeof prisma = prisma,
): Promise<
  Prisma.TruvernCreditLedgerEntryGetPayload<T>
> {
  return client.truvernCreditLedgerEntry.create(args);
}