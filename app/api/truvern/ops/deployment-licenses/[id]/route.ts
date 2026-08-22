import { NextResponse } from "next/server";

import {
  getDeploymentLicense,
  getDeploymentLicenseAudit,
} from "@/lib/licensing/deployment-license-service";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params: Promise<{
    id: string;
  }>;
};

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

export async function GET(
  _request: Request,
  context: Params,
) {
  try {
    await requireTruvernOperator();

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

    const license =
      await getDeploymentLicense(
        licenseId,
      );

    if (!license) {
      return json(404, {
        ok: false,
        error:
          "Deployment license not found.",
      });
    }

    const audit =
      await getDeploymentLicenseAudit(
        licenseId,
      );

    return json(200, {
      ok: true,
      license,
      audit,
    });
  }
  catch (error) {
    return json(500, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to read deployment license.",
    });
  }
}
