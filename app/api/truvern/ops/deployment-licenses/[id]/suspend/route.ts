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
  suspendDeploymentLicense,
} from "@/lib/licensing/deployment-license-service";

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
      safeString(body.reason);

    if (!reason) {
      return json(400, {
        ok: false,
        error:
          "reason is required.",
      });
    }

    const license =
      await suspendDeploymentLicense({
        id: licenseId,
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
        : "Failed to suspend deployment license.";

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
      "DEPLOYMENT_LICENSE_ALREADY_SUSPENDED"
    ) {
      return json(409, {
        ok: false,
        error:
          "Deployment license is already suspended.",
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

    return json(500, {
      ok: false,
      error: message,
    });
  }
}