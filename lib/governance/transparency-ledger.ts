import crypto from "crypto";

export type TransparencyLedgerEntry = {
  entryId: string;

  assignmentId: number;
  responseId: number;

  checksum: string;
  ledgerHash: string;

  receiptId: string;

  timestamp: string;

  previousEntryHash: string | null;

  entryHash: string;
};

function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex")
    .toUpperCase();
}

export function generateLedgerEntry(input: {
  assignmentId: number;
  responseId: number;

  checksum: string;
  ledgerHash: string;

  receiptId: string;

  timestamp?: string;

  previousEntryHash?: string | null;
}): TransparencyLedgerEntry {
  const timestamp =
    input.timestamp || new Date().toISOString();

  const entryId = `TRV-LEDGER-${crypto
    .randomBytes(10)
    .toString("hex")
    .toUpperCase()}`;

  const payload = JSON.stringify({
    entryId,

    assignmentId: input.assignmentId,
    responseId: input.responseId,

    checksum: input.checksum,
    ledgerHash: input.ledgerHash,

    receiptId: input.receiptId,

    timestamp,

    previousEntryHash:
      input.previousEntryHash || null,
  });

  const entryHash = sha256(payload);

  return {
    entryId,

    assignmentId: input.assignmentId,
    responseId: input.responseId,

    checksum: input.checksum,
    ledgerHash: input.ledgerHash,

    receiptId: input.receiptId,

    timestamp,

    previousEntryHash:
      input.previousEntryHash || null,

    entryHash,
  };
}
