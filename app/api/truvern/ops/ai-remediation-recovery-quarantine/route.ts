import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { quarantineExpiredAiReviewWorkerLease } from "@/lib/repositories/ai-review-worker-repository";
import { isRemediationReviewWorkerExecutionEnabled } from "@/lib/workflow/remediation-review-runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CERTIFICATION = "R22.7F.10CE-R198";

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

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return response(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "INVALID_TASK_ID",
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
      },
      400,
    );
  }

  const expectedConfirmation =
    `QUARANTINE-AI-REVIEW-TASK-${taskId}`;

  if (confirmation !== expectedConfirmation) {
    return response(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "CONFIRMATION_REQUIRED",
        taskId,
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
      },
      400,
    );
  }

  const quarantined =
    await quarantineExpiredAiReviewWorkerLease(
      taskId,
      actor.userId,
    );

  if (!quarantined) {
    return response(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "TASK_NOT_ELIGIBLE_FOR_RECOVERY_QUARANTINE",
        taskId,
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
      taskId: quarantined.taskId,
      packageId: quarantined.packageId,
      state: "UNCERTAIN_EXTERNAL_SIDE_EFFECT",
      assignedTo: "TRUVERN_AI_RECOVERY",
      quarantinedAt: quarantined.quarantinedAt,
      manualResolutionRequired: true,
      workerInvoked: false,
      providerInvoked: false,
      modelCalled: false,
    },
    200,
  );
}
