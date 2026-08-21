import {
  getAvailableReviewCredits,
  getReviewCreditBalance,
  insertReviewCreditReservation,
  insertReviewCreditReversal,
  reviewCreditEventExists,
  type ReviewCreditTransaction,
} from "@/lib/repositories/review-credit-ledger-repository";

export type {
  ReviewCreditBalance,
  ReviewCreditTransaction,
} from "@/lib/repositories/review-credit-ledger-repository";

export {
  getAvailableReviewCredits,
  getReviewCreditBalance,
  reviewCreditEventExists,
} from "@/lib/repositories/review-credit-ledger-repository";

export type ReviewCreditContext = {
  organizationId: number;
  assignmentId: number;
  reviewRequestId: number | null;
  vendorId: number;
};

export type ReviewCreditReservationInput =
  ReviewCreditContext & {
    actorUserId: string | null;
    cost: number;
    source?: string;
    eventKey?: string;
    note?: string;
    metadata?: Record<string, unknown>;
  };

export type ReviewCreditReservationResult =
  | {
      ok: true;
      eventKey: string;
      reservedCredits: number;
      reused: boolean;
      availableCredits: number;
    }
  | {
      ok: false;
      eventKey: string;
      requiredCredits: number;
      availableCredits: number;
    };

export type ReviewCreditReversalInput =
  ReviewCreditContext & {
    actorUserId: string | null;
    source: string;
    reason?: string | null;
    assessmentRunId?: number | null;
    eventKey?: string;
    note?: string;
    metadata?: Record<string, unknown>;
  };

export type ReviewCreditReversalResult = {
  eventKey: string;
  reversedCredits: number;
  reservedCredits: number;
  consumedCredits: number;
  reused: boolean;
};

function positiveInteger(
  value: unknown,
  fallback = 1,
): number {
  const numberValue = Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue <= 0
  ) {
    return fallback;
  }

  return Math.floor(numberValue);
}

export async function reserveReviewCredits(
  tx: ReviewCreditTransaction,
  input: ReviewCreditReservationInput,
): Promise<ReviewCreditReservationResult> {
  const cost = positiveInteger(input.cost);
  const eventKey =
    input.eventKey ??
    `review:${input.assignmentId}:reservation`;

  const availableCredits =
    await getAvailableReviewCredits(
      tx,
      input.organizationId,
    );

  const balance = await getReviewCreditBalance(
    tx,
    {
      organizationId: input.organizationId,
      assignmentId: input.assignmentId,
    },
  );

  /*
   * A positive existing reservation represents an
   * idempotent retry and must not consume another
   * available credit.
   */
  if (balance.reservedCredits > 0) {
    return {
      ok: true,
      eventKey,
      reservedCredits:
        balance.reservedCredits,
      reused: true,
      availableCredits,
    };
  }

  if (availableCredits < cost) {
    return {
      ok: false,
      eventKey,
      requiredCredits: cost,
      availableCredits,
    };
  }

  const reservationNote =
    input.note ??
    `Reserved ${cost} Truvern credit${
      cost === 1 ? "" : "s"
    } for expert review.`;

  const reservationMetadata = JSON.stringify({
    source:
      input.source ??
      "review_assignment_route_to_truvern",
    actorUserId: input.actorUserId,
    assignmentId: input.assignmentId,
    vendorId: input.vendorId,
    reviewRequestId:
      input.reviewRequestId,
    creditCost: cost,
    ...input.metadata,
  });

  await insertReviewCreditReservation(tx, {
    organizationId: input.organizationId,
    assignmentId: input.assignmentId,
    reviewRequestId: input.reviewRequestId,
    vendorId: input.vendorId,
    eventKey,
    quantity: cost,
    note: reservationNote,
    metadataJson: reservationMetadata,
  });

  return {
    ok: true,
    eventKey,
    reservedCredits: cost,
    reused: false,
    availableCredits,
  };
}

export async function reverseReviewCredits(
  tx: ReviewCreditTransaction,
  input: ReviewCreditReversalInput,
): Promise<ReviewCreditReversalResult> {
  const eventKey =
    input.eventKey ??
    `review:${input.assignmentId}:reservation_reversal`;

  const alreadyReversed =
    await reviewCreditEventExists(
      tx,
      eventKey,
    );

  const balance = await getReviewCreditBalance(
    tx,
    {
      organizationId: input.organizationId,
      assignmentId: input.assignmentId,
    },
  );

  if (alreadyReversed) {
    return {
      eventKey,
      reversedCredits: 0,
      reservedCredits:
        balance.reservedCredits,
      consumedCredits:
        balance.consumedCredits,
      reused: true,
    };
  }

  /*
   * Consumed credits are final. Only an outstanding
   * positive reservation can be reversed.
   */
  if (
    balance.reservedCredits <= 0 ||
    balance.consumedCredits > 0
  ) {
    return {
      eventKey,
      reversedCredits: 0,
      reservedCredits:
        balance.reservedCredits,
      consumedCredits:
        balance.consumedCredits,
      reused: false,
    };
  }

  const reversedCredits =
    balance.reservedCredits;

  const reversalNote =
    input.note ??
    `Reversed ${reversedCredits} reserved Truvern credit${
      reversedCredits === 1 ? "" : "s"
    }.`;

  const reversalMetadata = JSON.stringify({
    source: input.source,
    reason: input.reason ?? null,
    actorUserId: input.actorUserId,
    assessmentRunId:
      input.assessmentRunId ?? null,
    assignmentId: input.assignmentId,
    vendorId: input.vendorId,
    reviewRequestId:
      input.reviewRequestId,
    reversedCredits,
    ...input.metadata,
  });

  await insertReviewCreditReversal(tx, {
    organizationId: input.organizationId,
    assignmentId: input.assignmentId,
    reviewRequestId: input.reviewRequestId,
    vendorId: input.vendorId,
    eventKey,
    quantity: reversedCredits,
    note: reversalNote,
    metadataJson: reversalMetadata,
  });

  return {
    eventKey,
    reversedCredits,
    reservedCredits:
      balance.reservedCredits,
    consumedCredits:
      balance.consumedCredits,
    reused: false,
  };
}
