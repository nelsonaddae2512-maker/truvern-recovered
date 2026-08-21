import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export type ReviewAssignmentTransaction =
  Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0];

export type ReviewAssignmentContext = {
  id: number;
  organizationId: number;
  vendorId: number;
  reviewRequestId: number | null;
  status: string | null;
  assignmentType: string | null;
  reviewerUserId: string | null;
  startedAt: Date | null;
  claimedAt: Date | null;
  submittedAt: Date | null;
  requestTitle: string | null;
};

export async function readReviewAssignment(
  tx: ReviewAssignmentTransaction,
  assignmentId: number,
): Promise<ReviewAssignmentContext | null> {
  const assignment = await tx.reviewAssignment.findUnique({
    where: {
      id: assignmentId,
    },
    select: {
      id: true,
      organizationId: true,
      vendorId: true,
      reviewRequestId: true,
      status: true,
      assignmentType: true,
      reviewerUserId: true,
      startedAt: true,
      claimedAt: true,
      submittedAt: true,
      reviewRequest: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!assignment) {
    return null;
  }

  return {
    id: assignment.id,
    organizationId: assignment.organizationId,
    vendorId: assignment.vendorId,
    reviewRequestId: assignment.reviewRequestId,
    status:
      assignment.status == null
        ? null
        : String(assignment.status),
    assignmentType:
      assignment.assignmentType == null
        ? null
        : String(assignment.assignmentType),
    reviewerUserId: assignment.reviewerUserId,
    startedAt: assignment.startedAt,
    claimedAt: assignment.claimedAt,
    submittedAt: assignment.submittedAt,
    requestTitle:
      assignment.reviewRequest?.title ?? null,
  };
}

export async function lockReviewAssignment(
  tx: ReviewAssignmentTransaction,
  assignment: Pick<
    ReviewAssignmentContext,
    "id" | "organizationId"
  >,
): Promise<void> {
  await tx.$executeRaw`
    select pg_advisory_xact_lock(
      ${assignment.organizationId}::int,
      ${assignment.id}::int
    )
  `;
}
export type AssignReviewAssignmentInput = {
  assignmentId: number;
  reviewerUserId: string;
  reviewerName: string;
};

export async function persistAssignedReviewer(
  tx: ReviewAssignmentTransaction,
  input: AssignReviewAssignmentInput,
): Promise<void> {
  const existing = await tx.reviewAssignment.findUnique({
    where: {
      id: input.assignmentId,
    },
    select: {
      startedAt: true,
      claimedAt: true,
    },
  });

  if (!existing) {
    return;
  }

  const now = new Date();

  await tx.reviewAssignment.update({
    where: {
      id: input.assignmentId,
    },
    data: {
      reviewerUserId: input.reviewerUserId,
      assignedReviewerName: input.reviewerName,
      reviewerName: input.reviewerName,
      assignedTo: input.reviewerName,
      startedAt: existing.startedAt ?? now,
      claimedAt: existing.claimedAt ?? now,
      updatedAt: now,
      status: "IN_PROGRESS",
    },
  });
}

export async function persistTruvernAssignment(
  tx: ReviewAssignmentTransaction,
  assignmentId: number,
): Promise<void> {
  await tx.reviewAssignment.update({
    where: {
      id: assignmentId,
    },
    data: {
      assignmentType: "TRUVERN",
      reviewerUserId: null,
      assignedReviewerName: "Truvern expert",
      reviewerName: "Truvern expert",
      assignedTo: "Truvern expert",
      startedAt: null,
      claimedAt: null,
      updatedAt: new Date(),
      status: "PENDING",
    },
  });
}

export async function persistInternalAssignmentReset(
  tx: ReviewAssignmentTransaction,
  assignmentId: number,
): Promise<void> {
  await tx.reviewAssignment.update({
    where: {
      id: assignmentId,
    },
    data: {
      assignmentType: "INTERNAL",
      reviewerUserId: null,
      assignedReviewerName: null,
      reviewerName: null,
      assignedTo: null,
      startedAt: null,
      claimedAt: null,
      updatedAt: new Date(),
      status: "PENDING",
    },
  });
}
export async function findReviewAssignment<
  T extends Prisma.ReviewAssignmentFindUniqueArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.ReviewAssignmentFindUniqueArgs
  >,
): Promise<
  Prisma.ReviewAssignmentGetPayload<T> | null
> {
  return prisma.reviewAssignment.findUnique(args);
}
type ReviewAssignmentClient = Pick<
  Prisma.TransactionClient,
  "reviewAssignment"
>;

export async function findFirstReviewAssignment<
  T extends Prisma.ReviewAssignmentFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.ReviewAssignmentFindFirstArgs
  >,
  client: ReviewAssignmentClient = prisma,
): Promise<
  Prisma.ReviewAssignmentGetPayload<T> | null
> {
  return client.reviewAssignment.findFirst(args);
}
export async function updateReviewAssignment<
  T extends Prisma.ReviewAssignmentUpdateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.ReviewAssignmentUpdateArgs
  >,
  client: ReviewAssignmentClient = prisma,
): Promise<
  Prisma.ReviewAssignmentGetPayload<T>
> {
  return client.reviewAssignment.update(args);
}