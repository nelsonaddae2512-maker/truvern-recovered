import type { DeploymentLicenseType } from "@prisma/client";
import "server-only";

import crypto from "node:crypto";

import prisma from "@/lib/prisma";
import {
  hashDeploymentLicenseKey,
} from "@/lib/licensing/deployment-license";

export type IssuableDeploymentLicenseType =
  | "MANAGED_PRIVATE"
  | "CUSTOMER_PRIVATE";

export type IssueDeploymentLicenseInput = {
  organizationId: number;
  deploymentId: string;
  type: IssuableDeploymentLicenseType;

  startsAt?: Date;
  expiresAt?: Date | null;

  environment?: string | null;
  hostname?: string | null;

  createdByUserId: string;
  notes?: string | null;
};

export type IssuedDeploymentLicense = {
  license: {
    id: number;
    organizationId: number;
    deploymentId: string;
    type: IssuableDeploymentLicenseType;
    status: "ACTIVE";
    issuedAt: Date;
    startsAt: Date;
    expiresAt: Date | null;
    environment: string | null;
    hostname: string | null;
    createdByUserId: string | null;
    notes: string | null;
  };

  /*
   * Secret is returned exactly once by the issuance operation.
   * It is never persisted in plaintext.
   */
  licenseKey: string;
};

function normalizeRequired(
  value: string,
  field: string,
): string {
  const normalized =
    String(value || "").trim();

  if (!normalized) {
    throw new Error(
      `DEPLOYMENT_LICENSE_INVALID_INPUT:${field}`,
    );
  }

  return normalized;
}

function normalizeOptional(
  value: string | null | undefined,
): string | null {
  const normalized =
    String(value || "").trim();

  return normalized || null;
}

function validateInput(
  input: IssueDeploymentLicenseInput,
) {
  if (
    !Number.isInteger(input.organizationId) ||
    input.organizationId <= 0
  ) {
    throw new Error(
      "DEPLOYMENT_LICENSE_INVALID_INPUT:organizationId",
    );
  }

  if (
    input.type !== "MANAGED_PRIVATE" &&
    input.type !== "CUSTOMER_PRIVATE"
  ) {
    throw new Error(
      "DEPLOYMENT_LICENSE_INVALID_INPUT:type",
    );
  }

  const deploymentId =
    normalizeRequired(
      input.deploymentId,
      "deploymentId",
    );

  const createdByUserId =
    normalizeRequired(
      input.createdByUserId,
      "createdByUserId",
    );

  const startsAt =
    input.startsAt
      ? new Date(input.startsAt)
      : new Date();

  if (
    Number.isNaN(startsAt.getTime())
  ) {
    throw new Error(
      "DEPLOYMENT_LICENSE_INVALID_INPUT:startsAt",
    );
  }

  const expiresAt =
    input.expiresAt == null
      ? null
      : new Date(input.expiresAt);

  if (
    expiresAt &&
    Number.isNaN(expiresAt.getTime())
  ) {
    throw new Error(
      "DEPLOYMENT_LICENSE_INVALID_INPUT:expiresAt",
    );
  }

  if (
    expiresAt &&
    expiresAt <= startsAt
  ) {
    throw new Error(
      "DEPLOYMENT_LICENSE_INVALID_INPUT:expiresAt",
    );
  }

  return {
    organizationId: input.organizationId,
    deploymentId,
    type: input.type,
    startsAt,
    expiresAt,
    environment:
      normalizeOptional(input.environment),
    hostname:
      normalizeOptional(input.hostname),
    createdByUserId,
    notes:
      normalizeOptional(input.notes),
  };
}

function generateDeploymentLicenseKey(): string {
  /*
   * 32 random bytes = 256 bits of entropy.
   * The prefix makes the credential recognizable operationally
   * without reducing entropy.
   */
  return (
    "trv_live_" +
    crypto.randomBytes(32).toString("base64url")
  );
}

export async function issueDeploymentLicense(
  input: IssueDeploymentLicenseInput,
): Promise<IssuedDeploymentLicense> {
  const normalized =
    validateInput(input);

  const organization =
    await prisma.organization.findUnique({
      where: {
        id: normalized.organizationId,
      },
      select: {
        id: true,
      },
    });

  if (!organization) {
    throw new Error(
      "DEPLOYMENT_LICENSE_ORGANIZATION_NOT_FOUND",
    );
  }

  const existing =
    await prisma.deploymentLicense.findUnique({
      where: {
        deploymentId:
          normalized.deploymentId,
      },
      select: {
        id: true,
      },
    });

  if (existing) {
    throw new Error(
      "DEPLOYMENT_LICENSE_DEPLOYMENT_ID_EXISTS",
    );
  }

  const licenseKey =
    generateDeploymentLicenseKey();

  const licenseKeyHash =
    hashDeploymentLicenseKey(
      licenseKey,
    );

  const row =
    await prisma.$transaction(async (tx) => {
    const row =
      await tx.deploymentLicense.create({
        data: {
          organizationId:
            normalized.organizationId,

          deploymentId:
            normalized.deploymentId,

          licenseKeyHash,

          type:
            normalized.type,

          status:
            "ACTIVE",

          startsAt:
            normalized.startsAt,

          expiresAt:
            normalized.expiresAt,

          environment:
            normalized.environment,

          hostname:
            normalized.hostname,

          createdByUserId:
            normalized.createdByUserId,

          notes:
            normalized.notes,
        },
        select: {
          id: true,
          organizationId: true,
          deploymentId: true,
          type: true,
          status: true,
          issuedAt: true,
          startsAt: true,
          expiresAt: true,
          environment: true,
          hostname: true,
          createdByUserId: true,
          notes: true,
        },
      });

      await tx.deploymentLicenseAudit.create({
        data: {
          deploymentLicenseId: row.id,
          action: "ISSUED",
          actorUserId:
            normalized.createdByUserId,
          reason:
            normalized.notes,
          previousStatus: null,
          newStatus: "ACTIVE",
          previousExpiresAt: null,
          newExpiresAt:
            row.expiresAt,
        },
      });

      return row;
    });

  if (
    row.type !== "MANAGED_PRIVATE" &&
    row.type !== "CUSTOMER_PRIVATE"
  ) {
    throw new Error(
      "DEPLOYMENT_LICENSE_UNEXPECTED_TYPE",
    );
  }

  if (row.status !== "ACTIVE") {
    throw new Error(
      "DEPLOYMENT_LICENSE_UNEXPECTED_STATUS",
    );
  }

  return {
    license: {
      ...row,
      type: row.type,
      status: "ACTIVE",
    },
    licenseKey,
  };
}
export type DeploymentLicensePublicRecord = {
  id: number;
  organizationId: number;
  deploymentId: string;
  type: DeploymentLicenseType;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED";
  issuedAt: Date;
  startsAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  environment: string | null;
  hostname: string | null;
  createdByUserId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function publicDeploymentLicenseSelect() {
  return {
    id: true,
    organizationId: true,
    deploymentId: true,
    type: true,
    status: true,
    issuedAt: true,
    startsAt: true,
    expiresAt: true,
    revokedAt: true,
    environment: true,
    hostname: true,
    createdByUserId: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

function normalizeActorUserId(
  actorUserId: string,
): string {
  return normalizeRequired(
    actorUserId,
    "actorUserId",
  );
}

function normalizeReason(
  reason: string | null | undefined,
): string | null {
  return normalizeOptional(reason);
}

export async function listDeploymentLicenses(
  organizationId?: number,
): Promise<DeploymentLicensePublicRecord[]> {
  return prisma.deploymentLicense.findMany({
    where:
      organizationId == null
        ? undefined
        : {
            organizationId,
          },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    select:
      publicDeploymentLicenseSelect(),
  });
}

export async function getDeploymentLicense(
  id: number,
): Promise<DeploymentLicensePublicRecord | null> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(
      "DEPLOYMENT_LICENSE_INVALID_INPUT:id",
    );
  }

  return prisma.deploymentLicense.findUnique({
    where: {
      id,
    },
    select:
      publicDeploymentLicenseSelect(),
  });
}

export async function getDeploymentLicenseAudit(
  deploymentLicenseId: number,
) {
  if (
    !Number.isInteger(deploymentLicenseId) ||
    deploymentLicenseId <= 0
  ) {
    throw new Error(
      "DEPLOYMENT_LICENSE_INVALID_INPUT:id",
    );
  }

  return prisma.deploymentLicenseAudit.findMany({
    where: {
      deploymentLicenseId,
    },
    orderBy: [
      {
        createdAt: "asc",
      },
      {
        id: "asc",
      },
    ],
    select: {
      id: true,
      action: true,
      actorUserId: true,
      reason: true,
      previousStatus: true,
      newStatus: true,
      previousExpiresAt: true,
      newExpiresAt: true,
      createdAt: true,
    },
  });
}
export async function suspendDeploymentLicense(input: {
  id: number;
  actorUserId: string;
  reason?: string | null;
}): Promise<DeploymentLicensePublicRecord> {
  const actorUserId =
    normalizeActorUserId(
      input.actorUserId,
    );

  const reason =
    normalizeReason(input.reason);

  return prisma.$transaction(async (tx) => {
    const current =
      await tx.deploymentLicense.findUnique({
        where: {
          id: input.id,
        },
      });

    if (!current) {
      throw new Error(
        "DEPLOYMENT_LICENSE_NOT_FOUND",
      );
    }

    if (current.revokedAt) {
      throw new Error(
        "DEPLOYMENT_LICENSE_REVOKED_IMMUTABLE",
      );
    }

    if (current.status === "SUSPENDED") {
      throw new Error(
        "DEPLOYMENT_LICENSE_ALREADY_SUSPENDED",
      );
    }

    const updated =
      await tx.deploymentLicense.update({
        where: {
          id: input.id,
        },
        data: {
          status: "SUSPENDED",
        },
        select:
          publicDeploymentLicenseSelect(),
      });

    await tx.deploymentLicenseAudit.create({
      data: {
        deploymentLicenseId: input.id,
        action: "SUSPENDED",
        actorUserId,
        reason,
        previousStatus:
          current.status,
        newStatus:
          "SUSPENDED",
      },
    });

    return updated;
  });
}

export async function reactivateDeploymentLicense(input: {
  id: number;
  actorUserId: string;
  reason?: string | null;
}): Promise<DeploymentLicensePublicRecord> {
  const actorUserId =
    normalizeActorUserId(
      input.actorUserId,
    );

  const reason =
    normalizeReason(input.reason);

  return prisma.$transaction(async (tx) => {
    const current =
      await tx.deploymentLicense.findUnique({
        where: {
          id: input.id,
        },
      });

    if (!current) {
      throw new Error(
        "DEPLOYMENT_LICENSE_NOT_FOUND",
      );
    }

    if (
      current.revokedAt ||
      current.status === "REVOKED"
    ) {
      throw new Error(
        "DEPLOYMENT_LICENSE_REVOKED_IMMUTABLE",
      );
    }

    if (current.status !== "SUSPENDED") {
      throw new Error(
        "DEPLOYMENT_LICENSE_NOT_SUSPENDED",
      );
    }

    const now =
      new Date();

    if (
      current.expiresAt &&
      current.expiresAt <= now
    ) {
      throw new Error(
        "DEPLOYMENT_LICENSE_EXPIRED",
      );
    }

    const updated =
      await tx.deploymentLicense.update({
        where: {
          id: input.id,
        },
        data: {
          status: "ACTIVE",
        },
        select:
          publicDeploymentLicenseSelect(),
      });

    await tx.deploymentLicenseAudit.create({
      data: {
        deploymentLicenseId: input.id,
        action: "REACTIVATED",
        actorUserId,
        reason,
        previousStatus:
          current.status,
        newStatus:
          "ACTIVE",
      },
    });

    return updated;
  });
}

export async function revokeDeploymentLicense(input: {
  id: number;
  actorUserId: string;
  reason?: string | null;
}): Promise<DeploymentLicensePublicRecord> {
  const actorUserId =
    normalizeActorUserId(
      input.actorUserId,
    );

  const reason =
    normalizeReason(input.reason);

  return prisma.$transaction(async (tx) => {
    const current =
      await tx.deploymentLicense.findUnique({
        where: {
          id: input.id,
        },
      });

    if (!current) {
      throw new Error(
        "DEPLOYMENT_LICENSE_NOT_FOUND",
      );
    }

    if (
      current.revokedAt ||
      current.status === "REVOKED"
    ) {
      throw new Error(
        "DEPLOYMENT_LICENSE_ALREADY_REVOKED",
      );
    }

    const now =
      new Date();

    const updated =
      await tx.deploymentLicense.update({
        where: {
          id: input.id,
        },
        data: {
          status: "REVOKED",
          revokedAt: now,
        },
        select:
          publicDeploymentLicenseSelect(),
      });

    await tx.deploymentLicenseAudit.create({
      data: {
        deploymentLicenseId: input.id,
        action: "REVOKED",
        actorUserId,
        reason,
        previousStatus:
          current.status,
        newStatus:
          "REVOKED",
      },
    });

    return updated;
  });
}

export async function updateDeploymentLicenseExpiration(input: {
  id: number;
  expiresAt: Date | null;
  actorUserId: string;
  reason?: string | null;
}): Promise<DeploymentLicensePublicRecord> {
  const actorUserId =
    normalizeActorUserId(
      input.actorUserId,
    );

  const reason =
    normalizeReason(input.reason);

  const expiresAt =
    input.expiresAt == null
      ? null
      : new Date(input.expiresAt);

  if (
    expiresAt &&
    Number.isNaN(expiresAt.getTime())
  ) {
    throw new Error(
      "DEPLOYMENT_LICENSE_INVALID_INPUT:expiresAt",
    );
  }

  return prisma.$transaction(async (tx) => {
    const current =
      await tx.deploymentLicense.findUnique({
        where: {
          id: input.id,
        },
      });

    if (!current) {
      throw new Error(
        "DEPLOYMENT_LICENSE_NOT_FOUND",
      );
    }

    if (current.revokedAt) {
      throw new Error(
        "DEPLOYMENT_LICENSE_REVOKED_IMMUTABLE",
      );
    }

    if (
      expiresAt &&
      expiresAt <= current.startsAt
    ) {
      throw new Error(
        "DEPLOYMENT_LICENSE_INVALID_INPUT:expiresAt",
      );
    }

    const updated =
      await tx.deploymentLicense.update({
        where: {
          id: input.id,
        },
        data: {
          expiresAt,
        },
        select:
          publicDeploymentLicenseSelect(),
      });

    await tx.deploymentLicenseAudit.create({
      data: {
        deploymentLicenseId: input.id,
        action: "EXPIRATION_UPDATED",
        actorUserId,
        reason,
        previousExpiresAt:
          current.expiresAt,
        newExpiresAt:
          expiresAt,
      },
    });

    return updated;
  });
}

export async function rotateDeploymentLicenseKey(input: {
  id: number;
  actorUserId: string;
  reason?: string | null;
}): Promise<{
  license: DeploymentLicensePublicRecord;
  licenseKey: string;
}> {
  const actorUserId =
    normalizeActorUserId(
      input.actorUserId,
    );

  const reason =
    normalizeReason(input.reason);

  const licenseKey =
    generateDeploymentLicenseKey();

  const licenseKeyHash =
    hashDeploymentLicenseKey(
      licenseKey,
    );

  const license =
    await prisma.$transaction(async (tx) => {
      const current =
        await tx.deploymentLicense.findUnique({
          where: {
            id: input.id,
          },
        });

      if (!current) {
        throw new Error(
          "DEPLOYMENT_LICENSE_NOT_FOUND",
        );
      }

      if (current.revokedAt) {
        throw new Error(
          "DEPLOYMENT_LICENSE_REVOKED_IMMUTABLE",
        );
      }

      const updated =
        await tx.deploymentLicense.update({
          where: {
            id: input.id,
          },
          data: {
            licenseKeyHash,
          },
          select:
            publicDeploymentLicenseSelect(),
        });

      await tx.deploymentLicenseAudit.create({
        data: {
          deploymentLicenseId: input.id,
          action: "KEY_ROTATED",
          actorUserId,
          reason,
          previousStatus:
            current.status,
          newStatus:
            current.status,
        },
      });

      return updated;
    });

  return {
    license,
    licenseKey,
  };
}
