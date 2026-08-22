import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  issueDeploymentLicense,
  listDeploymentLicenses,
} from "@/lib/licensing/deployment-license-service";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RequestBody = Record<string, unknown>;

function safeString(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function safePositiveInteger(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function safeDate(
  value: unknown,
): Date | null {
  const text = safeString(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function safeLicenseType(
  value: unknown,
): "MANAGED_PRIVATE" | "CUSTOMER_PRIVATE" | null {
  const normalized =
    safeString(value)?.toUpperCase();

  if (
    normalized === "MANAGED_PRIVATE" ||
    normalized === "CUSTOMER_PRIVATE"
  ) {
    return normalized;
  }

  return null;
}

function json(
  status: number,
  body: Record<string, unknown>,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

async function readBody(
  request: Request,
): Promise<RequestBody> {
  const contentType =
    request.headers.get("content-type") || "";

  if (
    contentType.includes(
      "application/json",
    )
  ) {
    return request
      .json()
      .catch(() => ({}));
  }

  const form =
    await request
      .formData()
      .catch(() => null);

  if (!form) {
    return {};
  }

  return Object.fromEntries(
    form.entries(),
  );
}

export async function GET(
  request: Request,
) {
  await requireTruvernOperator();

  try {
    const url =
      new URL(request.url);

    const organizationText =
      url.searchParams.get(
        "organizationId",
      );

    let organizationId:
      | number
      | undefined;

    if (organizationText !== null) {
      const parsed =
        safePositiveInteger(
          organizationText,
        );

      if (!parsed) {
        return json(400, {
          ok: false,
          error:
            "Invalid organizationId.",
        });
      }

      organizationId = parsed;
    }

    const licenses =
      await listDeploymentLicenses(
        organizationId,
      );

    return json(200, {
      ok: true,
      licenses,
    });
  }
  catch (error) {
    return json(500, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to list deployment licenses.",
    });
  }
}

export async function POST(
  request: Request,
) {
  const operator =
    await requireTruvernOperator();

  try {
    const { userId } =
      await auth();

    const body =
      await readBody(request);

    const organizationId =
      safePositiveInteger(
        body.organizationId,
      );

    const deploymentId =
      safeString(
        body.deploymentId,
      );

    const type =
      safeLicenseType(
        body.type,
      );

    const startsAtText =
      safeString(
        body.startsAt,
      );

    const expiresAtText =
      safeString(
        body.expiresAt,
      );

    const startsAt =
      startsAtText
        ? safeDate(startsAtText)
        : new Date();

    const expiresAt =
      safeDate(
        expiresAtText,
      );

    const environment =
      safeString(
        body.environment,
      );

    const hostname =
      safeString(
        body.hostname,
      );

    const notes =
      safeString(
        body.notes,
      );

    if (!organizationId) {
      return json(400, {
        ok: false,
        error:
          "organizationId is required.",
      });
    }

    if (!deploymentId) {
      return json(400, {
        ok: false,
        error:
          "deploymentId is required.",
      });
    }

    if (!type) {
      return json(400, {
        ok: false,
        error:
          "type must be MANAGED_PRIVATE or CUSTOMER_PRIVATE.",
      });
    }

    if (
      startsAtText &&
      !startsAt
    ) {
      return json(400, {
        ok: false,
        error:
          "Invalid startsAt.",
      });
    }

    if (
      expiresAtText &&
      !expiresAt
    ) {
      return json(400, {
        ok: false,
        error:
          "Invalid expiresAt.",
      });
    }

    if (
      expiresAt &&
      startsAt &&
      expiresAt <= startsAt
    ) {
      return json(400, {
        ok: false,
        error:
          "expiresAt must be after startsAt.",
      });
    }

    const actorUserId =
      userId ??
      operator.userId;

    if (!actorUserId) {
      return json(500, {
        ok: false,
        error:
          "Unable to resolve operator identity.",
      });
    }

    const result =
      await issueDeploymentLicense({
        organizationId,
        deploymentId,
        type,
        startsAt:
          startsAt ?? new Date(),
        expiresAt,
        environment,
        hostname,
        createdByUserId:
          actorUserId,
        notes,
      });

    /*
     * licenseKey is intentionally returned
     * exactly once at issuance.
     *
     * It must never be persisted or included
     * by GET/list operations.
     */
    return json(201, {
      ok: true,
      license:
        result.license,
      licenseKey:
        result.licenseKey,
    });
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to issue deployment license.";

    if (
      message ===
      "DEPLOYMENT_LICENSE_ORGANIZATION_NOT_FOUND"
    ) {
      return json(404, {
        ok: false,
        error:
          "Organization not found.",
      });
    }

    if (
      message ===
      "DEPLOYMENT_LICENSE_DEPLOYMENT_ID_EXISTS"
    ) {
      return json(409, {
        ok: false,
        error:
          "deploymentId already exists.",
      });
    }

    return json(500, {
      ok: false,
      error: message,
    });
  }
}
