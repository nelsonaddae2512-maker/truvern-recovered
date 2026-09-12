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
  await requireOpsAccess();

  try {
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
