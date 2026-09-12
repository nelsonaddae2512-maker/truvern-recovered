import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import {
  REMEDIATION_REVIEW_RUNTIME_CONFIG_VERSION,
  hasConfiguredRemediationReviewApiKey,
  isRemediationReviewRuntimeEnabled,
} from "@/lib/workflow/remediation-review-runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await requireOpsAccess();

    return NextResponse.json(
      {
        ok: true,
        certification: "R22.7F.10CE-R41B",
        runtimeConfigVersion: REMEDIATION_REVIEW_RUNTIME_CONFIG_VERSION,
        runtimeEnabled: isRemediationReviewRuntimeEnabled(),
        apiKeyConfigured: hasConfiguredRemediationReviewApiKey(),
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "AI runtime certification failed.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
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
