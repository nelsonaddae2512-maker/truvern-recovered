import fs from "fs";
import path from "path";

export const TRUVERN_GOVERNANCE_RSA_V1_KEY_ID =
  "truvern-governance-rsa-4096-v1" as const;

export const TRUVERN_GOVERNANCE_RSA_V2_KEY_ID =
  "truvern-governance-rsa-4096-v2" as const;

export type TruvernGovernanceSigningKeyId =
  | typeof TRUVERN_GOVERNANCE_RSA_V1_KEY_ID
  | typeof TRUVERN_GOVERNANCE_RSA_V2_KEY_ID;

type SigningKeyDefinition = {
  keyId: TruvernGovernanceSigningKeyId;
  algorithm: "RSA-SHA256";
  privateKeyEnv: string;
  publicKeyEnv: string;
  privateKeyPathEnv: string;
  publicKeyPathEnv: string;
  developmentPrivateKeyPath: () => string;
  developmentPublicKeyPath: () => string;
};

const signingKeys: Record<
  TruvernGovernanceSigningKeyId,
  SigningKeyDefinition
> = {
  [TRUVERN_GOVERNANCE_RSA_V1_KEY_ID]: {
    keyId: TRUVERN_GOVERNANCE_RSA_V1_KEY_ID,
    algorithm: "RSA-SHA256",

    privateKeyEnv:
      "TRUVERN_SIGNING_PRIVATE_KEY",

    publicKeyEnv:
      "TRUVERN_SIGNING_PUBLIC_KEY",

    privateKeyPathEnv:
      "TRUVERN_SIGNING_PRIVATE_KEY_PATH",

    publicKeyPathEnv:
      "TRUVERN_SIGNING_PUBLIC_KEY_PATH",

    developmentPrivateKeyPath: () =>
      path.join(
        process.cwd(),
        "certs",
        "truvern-private.pem",
      ),

    developmentPublicKeyPath: () =>
      path.join(
        process.cwd(),
        "certs",
        "truvern-public.pem",
      ),
  },

  [TRUVERN_GOVERNANCE_RSA_V2_KEY_ID]: {
    keyId: TRUVERN_GOVERNANCE_RSA_V2_KEY_ID,
    algorithm: "RSA-SHA256",

    privateKeyEnv:
      "TRUVERN_SIGNING_PRIVATE_KEY_V2",

    publicKeyEnv:
      "TRUVERN_SIGNING_PUBLIC_KEY_V2",

    privateKeyPathEnv:
      "TRUVERN_SIGNING_PRIVATE_KEY_V2_PATH",

    publicKeyPathEnv:
      "TRUVERN_SIGNING_PUBLIC_KEY_V2_PATH",

    developmentPrivateKeyPath: () =>
      path.join(
        process.cwd(),
        "certs",
        "truvern-private-v2.pem",
      ),

    developmentPublicKeyPath: () =>
      path.join(
        process.cwd(),
        "certs",
        "truvern-public-v2.pem",
      ),
  },
};

export const ACTIVE_TRUVERN_GOVERNANCE_SIGNING_KEY_ID =
  TRUVERN_GOVERNANCE_RSA_V2_KEY_ID;

export function getActiveGovernanceSigningKey() {
  return signingKeys[
    ACTIVE_TRUVERN_GOVERNANCE_SIGNING_KEY_ID
  ];
}

export function getGovernanceSigningKey(
  keyId: string,
) {
  if (
    !Object.prototype.hasOwnProperty.call(
      signingKeys,
      keyId,
    )
  ) {
    return null;
  }

  return signingKeys[
    keyId as TruvernGovernanceSigningKeyId
  ];
}

function normalizePemEnvironmentValue(
  value: string,
) {
  return value.replace(/\\n/g, "\n").trim() + "\n";
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function readConfiguredKeyMaterial(args: {
  keyId: string;
  material: "private" | "public";
  valueEnv: string;
  pathEnv: string;
  developmentPath: () => string;
}) {
  const directValue =
    process.env[args.valueEnv]?.trim();

  if (directValue) {
    return normalizePemEnvironmentValue(
      directValue,
    );
  }

  const configuredPath =
    process.env[args.pathEnv]?.trim();

  if (configuredPath) {
    if (!fs.existsSync(configuredPath)) {
      throw new Error(
        `Configured governance ${args.material} key path does not exist for ${args.keyId}.`,
      );
    }

    return fs.readFileSync(
      configuredPath,
      "utf8",
    );
  }

  if (isProductionRuntime()) {
    throw new Error(
      `Missing production governance ${args.material} key material for ${args.keyId}.`,
    );
  }

  const developmentPath =
    args.developmentPath();

  if (!fs.existsSync(developmentPath)) {
    throw new Error(
      `Development governance ${args.material} key does not exist for ${args.keyId}.`,
    );
  }

  return fs.readFileSync(
    developmentPath,
    "utf8",
  );
}

export function readGovernancePrivateKey(
  keyId: string,
) {
  const key =
    getGovernanceSigningKey(keyId);

  if (!key) {
    throw new Error(
      `Unknown governance signing key: ${keyId}`,
    );
  }

  return readConfiguredKeyMaterial({
    keyId: key.keyId,
    material: "private",
    valueEnv: key.privateKeyEnv,
    pathEnv: key.privateKeyPathEnv,
    developmentPath:
      key.developmentPrivateKeyPath,
  });
}

export function readGovernancePublicKey(
  keyId: string,
) {
  const key =
    getGovernanceSigningKey(keyId);

  if (!key) {
    throw new Error(
      `Unknown governance signing key: ${keyId}`,
    );
  }

  return readConfiguredKeyMaterial({
    keyId: key.keyId,
    material: "public",
    valueEnv: key.publicKeyEnv,
    pathEnv: key.publicKeyPathEnv,
    developmentPath:
      key.developmentPublicKeyPath,
  });
}
