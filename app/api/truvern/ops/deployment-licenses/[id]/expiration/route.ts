import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { requireTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params: Promise<{
    id: string;
  }>;
};

type RequestBody =
  Record<string, unknown>;

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

function safePositiveInteger(
  value: unknown,
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function safeString(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed || null;
}

async function readBody(
  request: Request,
): Promise<RequestBody> {
  return request
    .json()
    .catch(() => ({}));
}

async function getActorUserId() {
  const operator =
    await requireTruvernOperator();

  const { userId } =
    await auth();

  return (
    userId ??
    operator.userId ??
    null
  );
}
import {
  updateDeploymentLicenseExpiration,
} from "@/lib/licensing/deployment-license-service";

function safeDate(
  value: unknown,
): Date | null {
  const text =
    safeString(value);

  if (!text) {
    return null;
  }

  const date =
    new Date(text);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date;
}

export async function POST(
  request: Request,
  context: Params,
) {
  try {
    const actorUserId =
      await getActorUserId();

    if (!actorUserId) {
      return json(500, {
        ok: false,
        error:
          "Unable to resolve operator identity.",
      });
    }

    const { id } =
      await context.params;

    const licenseId =
      safePositiveInteger(id);

    if (!licenseId) {
      return json(400, {
        ok: false,
        error:
          "Invalid deployment license id.",
      });
    }

    const body =
      await readBody(request);

    const reason =
      safeString(
        body.reason,
      );

    if (!reason) {
      return json(400, {
        ok: false,
        error:
          "reason is required.",
      });
    }

    const expiresAtText =
      safeString(
        body.expiresAt,
      );

    const clearExpiration =
      body.expiresAt === null;

    let expiresAt:
      Date | null;

    if (clearExpiration) {
      expiresAt = null;
    }
    else {
      expiresAt =
        safeDate(
          expiresAtText,
        );

      if (!expiresAt) {
        return json(400, {
          ok: false,
          error:
            "expiresAt must be a valid date or null.",
        });
      }
    }

    const license =
      await updateDeploymentLicenseExpiration({
        id: licenseId,
        expiresAt,
        actorUserId,
        reason,
      });

    return json(200, {
      ok: true,
      license,
    });
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update deployment license expiration.";

    if (
      message ===
      "DEPLOYMENT_LICENSE_NOT_FOUND"
    ) {
      return json(404, {
        ok: false,
        error:
          "Deployment license not found.",
      });
    }

    if (
      message ===
      "DEPLOYMENT_LICENSE_REVOKED_IMMUTABLE"
    ) {
      return json(409, {
        ok: false,
        error:
          "Revoked deployment licenses are immutable.",
      });
    }

    if (
      message ===
      "DEPLOYMENT_LICENSE_INVALID_INPUT:expiresAt"
    ) {
      return json(400, {
        ok: false,
        error:
          "Invalid deployment license expiration.",
      });
    }

    return json(500, {
      ok: false,
      error: message,
    });
  }
}