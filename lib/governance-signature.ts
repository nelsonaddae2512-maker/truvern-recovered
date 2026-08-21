import crypto from "crypto";

import {
  getActiveGovernanceSigningKey,
  getGovernanceSigningKey,
  readGovernancePrivateKey,
  readGovernancePublicKey,
} from "@/lib/governance-signing-keys";

export function signGovernancePayload(
  payload: unknown,
) {
  const key =
    getActiveGovernanceSigningKey();

  const privateKey =
    readGovernancePrivateKey(key.keyId);

  const canonicalPayload =
    JSON.stringify(payload);

  const signature = crypto.sign(
    "sha256",
    Buffer.from(canonicalPayload, "utf8"),
    privateKey,
  );

  return {
    algorithm: key.algorithm,
    signature: signature.toString("base64"),
    signedAt: new Date().toISOString(),
    keyId: key.keyId,
    payloadHash: crypto
      .createHash("sha256")
      .update(canonicalPayload)
      .digest("hex"),
  };
}

export function verifyGovernanceSignature(
  payload: unknown,
  signatureBase64: string,
  keyId?: string,
) {
  const resolvedKeyId =
    keyId ||
    getActiveGovernanceSigningKey().keyId;

  const key =
    getGovernanceSigningKey(resolvedKeyId);

  if (!key) {
    return false;
  }

  const publicKey =
    readGovernancePublicKey(key.keyId);

  const canonicalPayload =
    JSON.stringify(payload);

  return crypto.verify(
    "sha256",
    Buffer.from(canonicalPayload, "utf8"),
    publicKey,
    Buffer.from(signatureBase64, "base64"),
  );
}
