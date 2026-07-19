import crypto from "crypto";

export type GovernanceNotarizationReceipt = {
  receiptId: string;
  notarizationVersion: string;

  timestamp: string;

  checksum: string;
  signatureHash: string;

  ledgerHash: string;
};

function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex")
    .toUpperCase();
}

export function generateReceiptId() {
  return `TRV-NOTARY-${crypto
    .randomBytes(12)
    .toString("hex")
    .toUpperCase()}`;
}

export function createGovernanceNotarizationReceipt(input: {
  checksum: string;
  signature: string;
  timestamp?: string;
}) {
  const timestamp =
    input.timestamp || new Date().toISOString();

  const signatureHash = sha256(input.signature);

  const receiptId = generateReceiptId();

  const ledgerPayload = JSON.stringify({
    receiptId,
    timestamp,
    checksum: input.checksum,
    signatureHash,
  });

  const ledgerHash = sha256(ledgerPayload);

  return {
    receiptId,
    notarizationVersion: "TRV-NOTARY-1.0",

    timestamp,

    checksum: input.checksum,
    signatureHash,

    ledgerHash,
  } satisfies GovernanceNotarizationReceipt;
}
