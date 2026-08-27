import crypto from "crypto";

type UnknownRecord =
  Record<string, unknown>;

export type FrameworkSigningKeyDocument = {
  schema: string;
  algorithmFamily: string;
  activeKeyId?: string;
  verificationRule?: string;
  keys: Array<{
    keyId: string;
    algorithm: string;
    status?: string;
    publicKeyFingerprint: string;
    publicKeyPem: string;
  }>;
};

export type OfflineFrameworkReleaseVerificationInput = {
  governanceReleaseSnapshot: unknown;
  governanceSeal: unknown;
  signingKeys: FrameworkSigningKeyDocument;
};

export type OfflineFrameworkReleaseVerificationResult = {
  independentlyVerified: boolean;
  checksumVerified: boolean;
  payloadHashVerified: boolean;
  publicKeyFingerprintVerified: boolean;
  cryptographicVerified: boolean;
  keyId: string | null;
  algorithm: string | null;
  calculatedChecksum: string | null;
  reason: string | null;
};

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

/*
 * This canonicalizer intentionally mirrors Truvern's framework
 * release stable-JSON contract without importing application code.
 *
 * Objects:
 *   recursively sorted by property name.
 *
 * Arrays:
 *   preserve element order.
 *
 * Primitives:
 *   preserve JSON value semantics.
 */
export function canonicalizeOfflineFrameworkValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      canonicalizeOfflineFrameworkValue,
    );
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<UnknownRecord>(
        (result, key) => {
          result[key] =
            canonicalizeOfflineFrameworkValue(
              value[key],
            );

          return result;
        },
        {},
      );
  }

  return value;
}

export function stableOfflineFrameworkJson(
  value: unknown,
) {
  return JSON.stringify(
    canonicalizeOfflineFrameworkValue(
      value,
    ),
  );
}

export function checksumOfflineFrameworkSnapshot(
  snapshot: unknown,
) {
  return crypto
    .createHash("sha256")
    .update(
      stableOfflineFrameworkJson(
        snapshot,
      ),
      "utf8",
    )
    .digest("hex");
}

function failed(
  reason: string,
  partial?: Partial<
    OfflineFrameworkReleaseVerificationResult
  >,
): OfflineFrameworkReleaseVerificationResult {
  return {
    independentlyVerified: false,
    checksumVerified: false,
    payloadHashVerified: false,
    publicKeyFingerprintVerified: false,
    cryptographicVerified: false,
    keyId: null,
    algorithm: null,
    calculatedChecksum: null,
    reason,
    ...partial,
  };
}

export function verifyFrameworkReleaseOffline(
  input: OfflineFrameworkReleaseVerificationInput,
): OfflineFrameworkReleaseVerificationResult {

  if (
    !isRecord(
      input.governanceSeal,
    )
  ) {
    return failed(
      "Invalid governance seal.",
    );
  }

  const seal =
    input.governanceSeal;

  if (
    seal.algorithm !== "sha256"
  ) {
    return failed(
      "Unsupported governance checksum algorithm.",
    );
  }

  const storedChecksum =
    typeof seal.checksum === "string"
      ? seal.checksum
      : null;

  if (!storedChecksum) {
    return failed(
      "Governance checksum is missing.",
    );
  }

  const signatureCandidate =
    seal.cryptographicSignature;

  if (
    !isRecord(
      signatureCandidate,
    )
  ) {
    return failed(
      "Cryptographic signature is missing.",
    );
  }

  const signatureAlgorithm =
    typeof signatureCandidate.algorithm === "string"
      ? signatureCandidate.algorithm
      : null;

  const signatureValue =
    typeof signatureCandidate.signature === "string"
      ? signatureCandidate.signature
      : null;

  const keyId =
    typeof signatureCandidate.keyId === "string"
      ? signatureCandidate.keyId
      : null;

  const payloadHash =
    typeof signatureCandidate.payloadHash === "string"
      ? signatureCandidate.payloadHash
      : null;

  if (
    signatureAlgorithm !==
    "RSA-SHA256"
  ) {
    return failed(
      "Unsupported cryptographic signature algorithm.",
      {
        keyId,
        algorithm:
          signatureAlgorithm,
      },
    );
  }

  if (
    !signatureValue ||
    !keyId ||
    !payloadHash
  ) {
    return failed(
      "Cryptographic signature metadata is incomplete.",
      {
        keyId,
        algorithm:
          signatureAlgorithm,
      },
    );
  }

  if (
    input.signingKeys.schema !==
    "truvern.framework-governance.signing-keys.v1"
  ) {
    return failed(
      "Unsupported signing-key discovery schema.",
      {
        keyId,
        algorithm:
          signatureAlgorithm,
      },
    );
  }

  if (
    input.signingKeys.algorithmFamily !==
    "RSA-SHA256"
  ) {
    return failed(
      "Unsupported signing-key algorithm family.",
      {
        keyId,
        algorithm:
          signatureAlgorithm,
      },
    );
  }

  const key =
    input.signingKeys.keys.find(
      (candidate) =>
        candidate.keyId ===
        keyId,
    );

  if (!key) {
    return failed(
      "Persisted signing keyId is not present in the discovery document.",
      {
        keyId,
        algorithm:
          signatureAlgorithm,
      },
    );
  }

  if (
    key.algorithm !==
    "RSA-SHA256"
  ) {
    return failed(
      "Signing key algorithm does not match RSA-SHA256.",
      {
        keyId,
        algorithm:
          signatureAlgorithm,
      },
    );
  }

  const calculatedFingerprint =
    crypto
      .createHash("sha256")
      .update(
        key.publicKeyPem,
        "utf8",
      )
      .digest("hex");

  const publicKeyFingerprintVerified =
    calculatedFingerprint ===
    key.publicKeyFingerprint;

  if (
    !publicKeyFingerprintVerified
  ) {
    return failed(
      "Public-key fingerprint verification failed.",
      {
        keyId,
        algorithm:
          signatureAlgorithm,
        publicKeyFingerprintVerified:
          false,
      },
    );
  }

  const canonicalJson =
    stableOfflineFrameworkJson(
      input.governanceReleaseSnapshot,
    );

  const calculatedChecksum =
    crypto
      .createHash("sha256")
      .update(
        canonicalJson,
        "utf8",
      )
      .digest("hex");

  const checksumVerified =
    calculatedChecksum ===
    storedChecksum;

  const payloadHashVerified =
    calculatedChecksum ===
    payloadHash;

  let cryptographicVerified =
    false;

  try {
    cryptographicVerified =
      crypto.verify(
        "RSA-SHA256",
        Buffer.from(
          canonicalJson,
          "utf8",
        ),
        key.publicKeyPem,
        Buffer.from(
          signatureValue,
          "base64",
        ),
      );
  }
  catch {
    cryptographicVerified =
      false;
  }

  const independentlyVerified =
    checksumVerified &&
    payloadHashVerified &&
    publicKeyFingerprintVerified &&
    cryptographicVerified;

  return {
    independentlyVerified,
    checksumVerified,
    payloadHashVerified,
    publicKeyFingerprintVerified,
    cryptographicVerified,
    keyId,
    algorithm:
      signatureAlgorithm,
    calculatedChecksum,
    reason:
      independentlyVerified
        ? null
        : "Offline framework release verification failed.",
  };
}