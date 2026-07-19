import crypto from "crypto";
import fs from "fs";
import path from "path";

export function signGovernancePayload(payload: unknown) {
  const privateKeyPath =
    process.env.TRUVERN_SIGNING_PRIVATE_KEY_PATH ||
    path.join(process.cwd(), "certs", "truvern-private.pem");

  const privateKey = fs.readFileSync(privateKeyPath, "utf8");
  const canonicalPayload = JSON.stringify(payload);

  const signature = crypto.sign(
    "sha256",
    Buffer.from(canonicalPayload, "utf8"),
    privateKey,
  );

  return {
    algorithm: "RSA-SHA256",
    signature: signature.toString("base64"),
    signedAt: new Date().toISOString(),
    keyId: "truvern-governance-rsa-4096-v1",
    payloadHash: crypto
      .createHash("sha256")
      .update(canonicalPayload)
      .digest("hex"),
  };
}

export function verifyGovernanceSignature(payload: unknown, signatureBase64: string) {
  const publicKeyPath =
    process.env.TRUVERN_SIGNING_PUBLIC_KEY_PATH ||
    path.join(process.cwd(), "certs", "truvern-public.pem");

  const publicKey = fs.readFileSync(publicKeyPath, "utf8");
  const canonicalPayload = JSON.stringify(payload);

  return crypto.verify(
    "sha256",
    Buffer.from(canonicalPayload, "utf8"),
    publicKey,
    Buffer.from(signatureBase64, "base64"),
  );
}

