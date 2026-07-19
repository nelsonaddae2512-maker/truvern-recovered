import crypto from "crypto";
import fs from "fs";
import path from "path";

export type GovernanceSignaturePayload = {
  manifestId: number;
  assignmentId: number;
  checksum: string;
  issuedAt: string;
  vendorName?: string | null;
};

export type SignedGovernanceManifest = {
  algorithm: string;
  payload: GovernanceSignaturePayload;
  signature: string;
  publicKeyFingerprint: string;
  publicKeyPem: string;
};

const keyDir = path.join(process.cwd(), "governance-keys");

function readPrivateKey() {
  return fs.readFileSync(
    path.join(keyDir, "truvern-governance-private.pem"),
    "utf8",
  );
}

function readPublicKey() {
  return fs.readFileSync(
    path.join(keyDir, "truvern-governance-public.pem"),
    "utf8",
  );
}

export function createGovernanceSignature(
  payload: GovernanceSignaturePayload,
): SignedGovernanceManifest {
  const normalized = JSON.stringify(payload);

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(normalized);
  signer.end();

  const signature = signer.sign(readPrivateKey(), "base64");

  const publicKeyPem = readPublicKey();

  const publicKeyFingerprint = crypto
    .createHash("sha256")
    .update(publicKeyPem)
    .digest("hex");

  return {
    algorithm: "RSA-SHA256",
    payload,
    signature,
    publicKeyFingerprint,
    publicKeyPem,
  };
}

export function verifyGovernanceSignature(
  signed: SignedGovernanceManifest,
): boolean {
  const normalized = JSON.stringify(signed.payload);

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(normalized);
  verifier.end();

  return verifier.verify(
    signed.publicKeyPem,
    signed.signature,
    "base64",
  );
}

