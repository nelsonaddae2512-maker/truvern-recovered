import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { resolveQuarantinedAiReviewWorkerTaskWithoutAiResult } from "@/lib/repositories/ai-review-worker-repository";
import { isRemediationReviewWorkerExecutionEnabled } from "@/lib/workflow/remediation-review-runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CERTIFICATION = "R22.7F.10CE-R232";

function response(
  body: Record<string, unknown>,
  status: number,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const actor = await requireOpsAccess();

  if (isRemediationReviewWorkerExecutionEnabled()) {
    return response(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "AI_REVIEW_WORKER_NOT_QUIESCED",
        releaseReadinessRecheckRequired: false,
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
      },
      409,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return response(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "INVALID_JSON",
        releaseReadinessRecheckRequired: false,
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
      },
      400,
    );
  }

  const taskIdValue =
    typeof body === "object" &&
    body !== null &&
    "taskId" in body
      ? (body as { taskId?: unknown }).taskId
      : null;

  const taskId =
    typeof taskIdValue === "number"
      ? taskIdValue
      : Number(taskIdValue);

  const confirmation =
    typeof body === "object" &&
    body !== null &&
    "confirmation" in body
      ? String(
          (body as { confirmation?: unknown }).confirmation ?? "",
        ).trim()
      : "";

  const resolutionReason =
    typeof body === "object" &&
    body !== null &&
    "resolutionReason" in body
      ? String(
          (body as { resolutionReason?: unknown }).resolutionReason ?? "",
        ).trim()
      : "";

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return response(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "INVALID_TASK_ID",
        releaseReadinessRecheckRequired: false,
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
      },
      400,
    );
  }

  const expectedConfirmation =
    `RESOLVE-AI-REVIEW-TASK-${taskId}-WITHOUT-AI-RESULT`;

  if (confirmation !== expectedConfirmation) {
    return response(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "CONFIRMATION_REQUIRED",
        taskId,
        releaseReadinessRecheckRequired: false,
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
      },
      400,
    );
  }

  if (!resolutionReason) {
    return response(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "AI_REVIEW_RECOVERY_RESOLUTION_REASON_REQUIRED",
        taskId,
        releaseReadinessRecheckRequired: false,
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
      },
      400,
    );
  }

  if (resolutionReason.length > 2000) {
    return response(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "AI_REVIEW_RECOVERY_RESOLUTION_REASON_TOO_LONG",
        taskId,
        maxResolutionReasonLength: 2000,
        releaseReadinessRecheckRequired: false,
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
      },
      400,
    );
  }

  const resolved =
    await resolveQuarantinedAiReviewWorkerTaskWithoutAiResult(
      taskId,
      actor.userId,
      resolutionReason,
    );

  if (!resolved) {
    return response(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "TASK_NOT_ELIGIBLE_FOR_RECOVERY_RESOLUTION",
        taskId,
        releaseReadinessRecheckRequired: false,
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
      },
      409,
    );
  }

  return response(
    {
      ok: true,
      certification: CERTIFICATION,
      taskId: resolved.taskId,
      packageId: resolved.packageId,
      state: "RESOLVED_WITHOUT_AI_RESULT",
      resolution: "CLOSE_WITHOUT_AI_RESULT",
      result: "AI_PRE_REVIEW_RECOVERY_RESOLVED_WITHOUT_AI_RESULT",
      resolvedAt: resolved.resolvedAt,
      releaseReadinessRecheckRequired: true,
      releaseReadinessRechecked: false,
      releaseReadinessMutated: false,
      workerInvoked: false,
      providerInvoked: false,
      modelCalled: false,
    },
    200,
  );
}