import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import {
  REMEDIATION_REVIEW_RUNTIME_CONFIG_VERSION,
  hasConfiguredRemediationReviewApiKey,
  isRemediationReviewRuntimeEnabled,
  isRemediationReviewWorkerExecutionEnabled,
} from "@/lib/workflow/remediation-review-runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type DatabaseTargetIdentity =
  | {
      configured: false;
    }
  | {
      configured: true;
      scheme: string;
      host: string;
      port: number | null;
      database: string;
      user: string;
    };

function readDatabaseTargetIdentity(): DatabaseTargetIdentity {
  const raw = String(process.env.DATABASE_URL ?? "").trim();

  if (!raw) {
    return {
      configured: false,
    };
  }

  const parsed = new URL(raw);

  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();

  if (scheme !== "postgresql" && scheme !== "postgres") {
    throw new Error("Unexpected DATABASE_URL scheme.");
  }

  const database = decodeURIComponent(
    parsed.pathname.replace(/^\/+/, ""),
  );

  const user = decodeURIComponent(parsed.username);

  const port =
    parsed.port.length > 0
      ? Number(parsed.port)
      : null;

  if (
    !parsed.hostname ||
    !database ||
    !user ||
    (port !== null && !Number.isSafeInteger(port))
  ) {
    throw new Error("DATABASE_URL target identity is incomplete.");
  }

  return {
    configured: true,
    scheme,
    host: parsed.hostname.toLowerCase(),
    port,
    database,
    user,
  };
}

export async function GET() {
  await requireOpsAccess();

  try {
    return NextResponse.json(
      {
        ok: true,
        certification: "R22.7F.10CE-R168",
        runtimeConfigVersion:
          REMEDIATION_REVIEW_RUNTIME_CONFIG_VERSION,
        runtimeEnabled:
          isRemediationReviewRuntimeEnabled(),
        workerExecutionEnabled:
          isRemediationReviewWorkerExecutionEnabled(),
        apiKeyConfigured:
          hasConfiguredRemediationReviewApiKey(),
        databaseTarget:
          readDatabaseTargetIdentity(),
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
        databaseIdentityDerivedFromEnv: true,
        diagnosticDatabaseConnectionAttempted: false,
        diagnosticDatabaseQuery: false,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "AI runtime certification failed.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
