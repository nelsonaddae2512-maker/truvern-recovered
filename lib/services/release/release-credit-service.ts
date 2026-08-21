import {
  insertCreditConsumptionLedgerEntry,
  readExistingCreditConsumption,
  readReservedCreditBalance,
} from "@/lib/repositories/release-credit-repository";

export type ConsumeReservedReviewCreditsInput = {
  assignmentId: number;
  responseId: number;
  organizationId: number;
  vendorId?: number | null;
  vendorName?: string | null;
};

export type CreditConsumptionResult = {
  consumed: boolean;
  alreadyConsumed: boolean;
  reservedCredits?: number;
  eventKey: string;
};

export async function consumeReservedReviewCredits(
  input: ConsumeReservedReviewCreditsInput,
): Promise<CreditConsumptionResult> {
  const eventKey = `review:${input.assignmentId}:consumption`;

  const alreadyConsumedRows: Array<{ count: number }> =
    await readExistingCreditConsumption(eventKey);

  if (Number(alreadyConsumedRows?.[0]?.count ?? 0) > 0) {
    return {
      consumed: false,
      alreadyConsumed: true,
      eventKey,
    };
  }

  const reservationRows: Array<{ reservedCredits: number }> =
    await readReservedCreditBalance(
      input.organizationId,
      input.assignmentId,
    );

  const reservedCredits = Number(
    reservationRows?.[0]?.reservedCredits ?? 0,
  );

  if (reservedCredits <= 0) {
    return {
      consumed: false,
      alreadyConsumed: false,
      reservedCredits,
      eventKey,
    };
  }

  await insertCreditConsumptionLedgerEntry({
    organizationId: input.organizationId,
    assignmentId: input.assignmentId,
    eventKey,
    reservedCredits,
    note: `Consumed ${reservedCredits} reserved Truvern credit${
      reservedCredits === 1 ? "" : "s"
    } after release confirmation.`,
    metadataJson: JSON.stringify({
      source: "review_release_confirmation",
      assignmentId: input.assignmentId,
      responseId: input.responseId,
      vendorId: input.vendorId ?? null,
      vendorName: input.vendorName ?? null,
      consumedCredits: reservedCredits,
    }),
  });

  return {
    consumed: true,
    alreadyConsumed: false,
    reservedCredits,
    eventKey,
  };
}
