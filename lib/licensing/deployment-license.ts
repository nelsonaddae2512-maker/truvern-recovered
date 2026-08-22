import crypto from "node:crypto";

import prisma from "@/lib/prisma";

export type DeploymentMode =
  | "SAAS"
  | "MANAGED_PRIVATE"
  | "CUSTOMER_PRIVATE"
  | "INVALID";

export type DeploymentLicenseResolution =
  | {
      required: false;
      valid: true;
      mode: "SAAS";
      reason: "SAAS_LICENSE_NOT_REQUIRED";
      licenseId: null;
      organizationId: null;
      deploymentId: null;
      expiresAt: null;
    }
  | {
      required: true;
      valid: true;
      mode: "MANAGED_PRIVATE" | "CUSTOMER_PRIVATE";
      reason: "LICENSE_VALID";
      licenseId: number;
      organizationId: number;
      deploymentId: string;
      expiresAt: Date | null;
    }
  | {
      required: true;
      valid: false;
      mode:
        | "MANAGED_PRIVATE"
        | "CUSTOMER_PRIVATE"
        | "INVALID";
      reason:
        | "INVALID_DEPLOYMENT_MODE"
        | "CONFIGURATION_MISSING"
        | "LICENSE_NOT_FOUND"
        | "LICENSE_NOT_ACTIVE"
        | "LICENSE_NOT_STARTED"
        | "LICENSE_EXPIRED"
        | "LICENSE_REVOKED"
        | "LICENSE_TYPE_MISMATCH"
        | "LICENSE_KEY_MISMATCH"
        | "ENVIRONMENT_MISMATCH"
        | "HOSTNAME_MISMATCH";
      licenseId: number | null;
      organizationId: number | null;
      deploymentId: string | null;
      expiresAt: Date | null;
    };

function normalize(value: string | undefined): string {
  return String(value || "").trim();
}

function normalizeUpper(
  value: string | undefined,
): string {
  return normalize(value).toUpperCase();
}

function normalizeLower(
  value: string | null | undefined,
): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function resolveDeploymentMode(): DeploymentMode {
  const value =
    normalizeUpper(
      process.env.TRUVERN_DEPLOYMENT_MODE,
    );

  if (!value || value === "SAAS") {
    return "SAAS";
  }

  if (value === "MANAGED_PRIVATE") {
    return "MANAGED_PRIVATE";
  }

  if (value === "CUSTOMER_PRIVATE") {
    return "CUSTOMER_PRIVATE";
  }

  return "INVALID";
}

export function hashDeploymentLicenseKey(
  licenseKey: string,
): string {
  return crypto
    .createHash("sha256")
    .update(licenseKey, "utf8")
    .digest("hex");
}

export async function resolveDeploymentLicense():
  Promise<DeploymentLicenseResolution> {
  const mode = resolveDeploymentMode();

  if (mode === "INVALID") {
    return {
      required: true,
      valid: false,
      mode,
      reason: "INVALID_DEPLOYMENT_MODE",
      licenseId: null,
      organizationId: null,
      deploymentId: null,
      expiresAt: null,
    };
  }

  /*
   * Normal Truvern-hosted SaaS does not require a deployment
   * license. Commercial access remains governed independently
   * by the organization subscription/override resolver.
   */
  if (mode === "SAAS") {
    return {
      required: false,
      valid: true,
      mode,
      reason: "SAAS_LICENSE_NOT_REQUIRED",
      licenseId: null,
      organizationId: null,
      deploymentId: null,
      expiresAt: null,
    };
  }

  const deploymentId =
    normalize(process.env.TRUVERN_DEPLOYMENT_ID);

  const licenseKey =
    normalize(process.env.TRUVERN_LICENSE_KEY);

  if (!deploymentId || !licenseKey) {
    return {
      required: true,
      valid: false,
      mode,
      reason: "CONFIGURATION_MISSING",
      licenseId: null,
      organizationId: null,
      deploymentId:
        deploymentId || null,
      expiresAt: null,
    };
  }

  const row =
    await prisma.deploymentLicense.findUnique({
      where: {
        deploymentId,
      },
      select: {
        id: true,
        organizationId: true,
        licenseKeyHash: true,
        deploymentId: true,
        type: true,
        status: true,
        startsAt: true,
        expiresAt: true,
        revokedAt: true,
        environment: true,
        hostname: true,
      },
    });

  if (!row) {
    return {
      required: true,
      valid: false,
      mode,
      reason: "LICENSE_NOT_FOUND",
      licenseId: null,
      organizationId: null,
      deploymentId,
      expiresAt: null,
    };
  }

  const base = {
    required: true as const,
    valid: false as const,
    mode,
    licenseId: row.id,
    organizationId: row.organizationId,
    deploymentId: row.deploymentId,
    expiresAt: row.expiresAt,
  };

  if (row.revokedAt) {
    return {
      ...base,
      reason: "LICENSE_REVOKED",
    };
  }

  if (String(row.status) !== "ACTIVE") {
    return {
      ...base,
      reason: "LICENSE_NOT_ACTIVE",
    };
  }

  const now = new Date();

  if (row.startsAt > now) {
    return {
      ...base,
      reason: "LICENSE_NOT_STARTED",
    };
  }

  if (
    row.expiresAt &&
    row.expiresAt <= now
  ) {
    return {
      ...base,
      reason: "LICENSE_EXPIRED",
    };
  }

  if (String(row.type) !== mode) {
    return {
      ...base,
      reason: "LICENSE_TYPE_MISMATCH",
    };
  }

  const suppliedHash =
    hashDeploymentLicenseKey(licenseKey);

  const storedBuffer =
    Buffer.from(row.licenseKeyHash, "utf8");

  const suppliedBuffer =
    Buffer.from(suppliedHash, "utf8");

  if (
    storedBuffer.length !== suppliedBuffer.length ||
    !crypto.timingSafeEqual(
      storedBuffer,
      suppliedBuffer,
    )
  ) {
    return {
      ...base,
      reason: "LICENSE_KEY_MISMATCH",
    };
  }

  const configuredEnvironment =
    normalizeLower(
      process.env.TRUVERN_DEPLOYMENT_ENVIRONMENT,
    );

  const licensedEnvironment =
    normalizeLower(row.environment);

  if (
    licensedEnvironment &&
    configuredEnvironment !== licensedEnvironment
  ) {
    return {
      ...base,
      reason: "ENVIRONMENT_MISMATCH",
    };
  }

  const configuredHostname =
    normalizeLower(
      process.env.TRUVERN_DEPLOYMENT_HOSTNAME,
    );

  const licensedHostname =
    normalizeLower(row.hostname);

  if (
    licensedHostname &&
    configuredHostname !== licensedHostname
  ) {
    return {
      ...base,
      reason: "HOSTNAME_MISMATCH",
    };
  }

  return {
    required: true,
    valid: true,
    mode,
    reason: "LICENSE_VALID",
    licenseId: row.id,
    organizationId: row.organizationId,
    deploymentId: row.deploymentId,
    expiresAt: row.expiresAt,
  };
}

export class DeploymentLicenseError extends Error {
  readonly code =
    "TRUVERN_DEPLOYMENT_LICENSE_INVALID";

  readonly reason:
    Extract<
      DeploymentLicenseResolution,
      { valid: false }
    >["reason"];

  constructor(
    reason:
      Extract<
        DeploymentLicenseResolution,
        { valid: false }
      >["reason"],
  ) {
    super(
      `TRUVERN_DEPLOYMENT_LICENSE_INVALID:${reason}`,
    );

    this.name = "DeploymentLicenseError";
    this.reason = reason;
  }
}

export async function requireValidDeploymentLicense():
  Promise<DeploymentLicenseResolution> {
  const resolution =
    await resolveDeploymentLicense();

  if (!resolution.valid) {
    throw new DeploymentLicenseError(
      resolution.reason,
    );
  }

  return resolution;
}