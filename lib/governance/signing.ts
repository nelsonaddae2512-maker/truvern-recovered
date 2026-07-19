import crypto from "crypto";

export type GovernanceSignatureBundle = {
  algorithm: "ed25519";
  publicKey: string;
  signature: string;
};

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(
      value as Record<string, unknown>,
    ).sort(([a], [b]) => a.localeCompare(b));

    return `{${entries
      .map(
        ([key, val]) =>
          `${JSON.stringify(key)}:${canonicalize(val)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(String(value));
}

export function canonicalizeGovernancePayload(
  payload: unknown,
) {
  return canonicalize(payload);
}

export function generateGovernanceSigningKeyPair() {
  return crypto.generateKeyPairSync("ed25519");
}

function resolvePrivateKey() {
  const privateKeyPem =
    process.env.GOVERNANCE_PRIVATE_KEY?.trim();

  if (!privateKeyPem) {
    throw new Error(
      "Missing GOVERNANCE_PRIVATE_KEY environment variable.",
    );
  }

  return crypto.createPrivateKey(privateKeyPem);
}

function resolvePublicKey() {
  const publicKeyPem =
    process.env.GOVERNANCE_PUBLIC_KEY?.trim();

  if (!publicKeyPem) {
    throw new Error(
      "Missing GOVERNANCE_PUBLIC_KEY environment variable.",
    );
  }

  return crypto.createPublicKey(publicKeyPem);
}

export function signGovernancePayload(
  payload: unknown,
): GovernanceSignatureBundle {
  const canonical =
    canonicalizeGovernancePayload(payload);

  const signature = crypto.sign(
    null,
    Buffer.from(canonical),
    resolvePrivateKey(),
  );

  return {
    algorithm: "ed25519",
    publicKey: process.env.GOVERNANCE_PUBLIC_KEY || "",
    signature: signature.toString("base64"),
  };
}

export function verifyGovernanceSignature(
  payload: unknown,
  bundle: GovernanceSignatureBundle,
) {
  const canonical =
    canonicalizeGovernancePayload(payload);

  return crypto.verify(
    null,
    Buffer.from(canonical),
    crypto.createPublicKey(bundle.publicKey),
    Buffer.from(bundle.signature, "base64"),
  );
}

export function exportGovernancePublicKey() {
  return process.env.GOVERNANCE_PUBLIC_KEY || "";
}
