import prisma from "@/lib/prisma";
import {
  lockReviewAssignment,
  persistAssignedReviewer,
  persistInternalAssignmentReset,
  persistTruvernAssignment,
  readReviewAssignment,
  type ReviewAssignmentContext,
  type ReviewAssignmentTransaction,
} from "@/lib/repositories/review-assignment-repository";
import {
  reserveReviewCredits,
  reverseReviewCredits,
} from "@/lib/services/review-credit-ledger-service";

export type ReviewAssignmentAction =
  | "assign"
  | "truvern"
  | "unassign";

export type ReviewAssignmentServiceInput = {
  assignmentId: number;
  action: ReviewAssignmentAction;
  actorUserId: string;
  actorName?: string | null;
  reviewerUserId?: string | null;
  reviewerName?: string | null;
  reviewCreditCost?: number;
  acceptedLegal?: boolean;
  acceptanceVersion?: string | null;
};

export type ReviewAssignmentSuccess = {
  ok: true;
  status: 200;
  assignmentId: number;
  organizationId: number;
  vendorId: number;
  reviewRequestId: number | null;
  action: ReviewAssignmentAction;
  reviewerUserId?: string;
  reviewerName?: string;
  reservation?: {
    eventKey: string;
    reservedCredits: number;
    reused: boolean;
  } | null;
  creditReversal?: {
    eventKey: string;
    reversedCredits: number;
    reused: boolean;
  } | null;
};

export type ReviewAssignmentFailure = {
  ok: false;
  status: 400 | 402 | 404 | 409;
  error: string;
  code?: string;
  requiredCredits?: number;
  availableCredits?: number;
  fundingUrl?: string;
};

export type ReviewAssignmentServiceResult =
  | ReviewAssignmentSuccess
  | ReviewAssignmentFailure;

function safeString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function upper(value: unknown): string {
  return safeString(value).toUpperCase();
}

function validPositiveInteger(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

function resolveCreditCost(
  inputCost: number | undefined,
): number {
  if (
    validPositiveInteger(inputCost)
  ) {
    return inputCost;
  }

  const configured =
    Number(
      String(
        process.env
          .TRUVERN_REVIEW_CREDIT_COST ??
          "",
      ).trim(),
    );

  return validPositiveInteger(configured)
    ? configured
    : 1;
}

async function assignReviewer(
  tx: Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0],
  assignment: ReviewAssignmentContext,
  input: ReviewAssignmentServiceInput,
): Promise<ReviewAssignmentServiceResult> {
  const reviewerUserId =
    safeString(input.reviewerUserId);

  if (!reviewerUserId) {
    return {
      ok: false,
      status: 400,
      error: "Reviewer user id required",
    };
  }

  const reviewerName =
    safeString(input.reviewerName) ||
    safeString(input.actorName) ||
    "Internal reviewer";

  await persistAssignedReviewer(
    tx,
    {
      assignmentId: assignment.id,
      reviewerUserId,
      reviewerName,
    },
  );

  return {
    ok: true,
    status: 200,
    assignmentId: assignment.id,
    organizationId:
      assignment.organizationId,
    vendorId: assignment.vendorId,
    reviewRequestId:
      assignment.reviewRequestId,
    action: "assign",
    reviewerUserId,
    reviewerName,
  };
}

async function routeToTruvern(
  tx: Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0],
  assignment: ReviewAssignmentContext,
  input: ReviewAssignmentServiceInput,
): Promise<ReviewAssignmentServiceResult> {
  const alreadyStarted =
    upper(assignment.status) !== "PENDING" ||
    Boolean(assignment.startedAt) ||
    Boolean(assignment.claimedAt) ||
    Boolean(assignment.submittedAt);

  if (alreadyStarted) {
    return {
      ok: false,
      status: 409,
      code: "REVIEW_ALREADY_STARTED",
      error:
        "This review has already started and cannot be routed to Truvern.",
    };
  }

  const cost =
    resolveCreditCost(
      input.reviewCreditCost,
    );

  const creditReservation =
    await reserveReviewCredits(
      tx,
      {
        organizationId:
          assignment.organizationId,
        assignmentId: assignment.id,
        reviewRequestId:
          assignment.reviewRequestId,
        vendorId: assignment.vendorId,
        actorUserId:
          input.actorUserId,
        cost,
        source:
          "review_assignment_route_to_truvern",
      },
    );

  if (!creditReservation.ok) {
    return {
      ok: false,
      status: 402,
      code: "TRUVERN_ACCESS_REQUIRED",
      error:
        "Truvern Expert Review requires available Truvern credits.",
      requiredCredits:
        creditReservation.requiredCredits,
      availableCredits:
        creditReservation.availableCredits,
      fundingUrl: "/billing/credits",
    };
  }

  const reservation = {
    eventKey:
      creditReservation.eventKey,
    reservedCredits:
      creditReservation.reservedCredits,
    reused:
      creditReservation.reused,
  };

  await persistTruvernAssignment(
    tx,
    assignment.id,
  );

  return {
    ok: true,
    status: 200,
    assignmentId: assignment.id,
    organizationId:
      assignment.organizationId,
    vendorId: assignment.vendorId,
    reviewRequestId:
      assignment.reviewRequestId,
    action: "truvern",
    reservation,
  };
}

async function unassignReview(
  tx: Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0],
  assignment: ReviewAssignmentContext,
  input: ReviewAssignmentServiceInput,
): Promise<ReviewAssignmentServiceResult> {
  const isTruvern =
    upper(
      assignment.assignmentType,
    ) === "TRUVERN";

  const started =
    upper(assignment.status) !== "PENDING" ||
    Boolean(assignment.reviewerUserId) ||
    Boolean(assignment.startedAt) ||
    Boolean(assignment.claimedAt) ||
    Boolean(assignment.submittedAt);

  if (isTruvern && started) {
    return {
      ok: false,
      status: 409,
      code:
        "TRUVERN_REVIEW_ALREADY_STARTED",
      error:
        "This Truvern review has already started and cannot be unassigned.",
    };
  }

  let creditReversal:
    | {
        eventKey: string;
        reversedCredits: number;
        reused: boolean;
      }
    | null = null;

  if (isTruvern) {
    const reversal =
      await reverseReviewCredits(
        tx,
        {
          organizationId:
            assignment.organizationId,
          assignmentId:
            assignment.id,
          reviewRequestId:
            assignment.reviewRequestId,
          vendorId:
            assignment.vendorId,
          actorUserId:
            input.actorUserId,
          source:
            "review_assignment_unassign",
          note:
            "Reversed reserved Truvern credits after unassigning pending review.",
        },
      );

    /*
     * Preserve the previous response behavior:
     * - return a result when credits were reversed;
     * - return an idempotent result when already reversed;
     * - otherwise leave creditReversal null.
     */
    if (
      reversal.reversedCredits > 0 ||
      reversal.reused
    ) {
      creditReversal = {
        eventKey:
          reversal.eventKey,
        reversedCredits:
          reversal.reversedCredits,
        reused:
          reversal.reused,
      };
    }
  }

  await persistInternalAssignmentReset(
    tx,
    assignment.id,
  );

  return {
    ok: true,
    status: 200,
    assignmentId: assignment.id,
    organizationId:
      assignment.organizationId,
    vendorId: assignment.vendorId,
    reviewRequestId:
      assignment.reviewRequestId,
    action: "unassign",
    creditReversal,
  };
}

export async function mutateReviewAssignment(
  input: ReviewAssignmentServiceInput,
): Promise<ReviewAssignmentServiceResult> {
  if (
    !validPositiveInteger(
      input.assignmentId,
    )
  ) {
    return {
      ok: false,
      status: 400,
      error: "Invalid assignment id",
    };
  }

  if (
    !safeString(input.actorUserId)
  ) {
    return {
      ok: false,
      status: 400,
      error: "Actor user id required",
    };
  }

  if (
    ![
      "assign",
      "truvern",
      "unassign",
    ].includes(input.action)
  ) {
    return {
      ok: false,
      status: 400,
      error:
        "Invalid assignment action",
    };
  }

  if (
    input.action === "truvern" &&
    (
      input.acceptedLegal !== true ||
      safeString(input.acceptanceVersion) !==
        "TRV-LEGAL-1.0"
    )
  ) {
    return {
      ok: false,
      status: 400,
      code:
        "TRUVERN_LEGAL_ACCEPTANCE_REQUIRED",
      error:
        "TRV-LEGAL-1.0 acceptance is required before activating Professional Review.",
    };
  }
  return prisma.$transaction(
    async (tx) => {
      const assignment =
        await readReviewAssignment(
          tx,
          input.assignmentId,
        );

      if (!assignment) {
        return {
          ok: false,
          status: 404,
          error:
            "Assignment not found",
        };
      }

      await lockReviewAssignment(
        tx,
        assignment,
      );

      if (input.action === "assign") {
        return assignReviewer(
          tx,
          assignment,
          input,
        );
      }

      if (
        input.action === "truvern"
      ) {
        return routeToTruvern(
          tx,
          assignment,
          input,
        );
      }

      return unassignReview(
        tx,
        assignment,
        input,
      );
    },
  );
}
