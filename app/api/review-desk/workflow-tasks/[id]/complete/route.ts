import { NextResponse } from "next/server";
import {
  requireReviewerAccess,
  requireReviewAssignmentAccess,
} from "@/lib/auth/truvern-governance";
import {
  governanceAuthErrorResponse,
  governanceForbidden,
} from "@/lib/auth/governance-auth-errors";
import { readWorkflowTaskForAuthorization } from "@/lib/repositories/workflow-task-repository";
import { completeWorkflowTask } from "@/lib/workflow/workflow-task-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: Request, props: Props) {
  try {
    const actor = await requireReviewerAccess();
    const resolved = await props.params;
    const taskId = Number(resolved.id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid task id." },
        { status: 400 },
      );
    }

    const taskRows = await readWorkflowTaskForAuthorization(taskId);
    const task = taskRows[0];

    if (!task) {
      return NextResponse.json(
        { ok: false, error: "Task not found." },
        { status: 404 },
      );
    }

    if (task.reviewAssignmentId != null) {
      await requireReviewAssignmentAccess(Number(task.reviewAssignmentId));
    } else if (
      actor.role !== "OPS" &&
      (
        actor.role === "TRUVERN_REVIEWER" ||
        actor.organizationId == null ||
        Number(actor.organizationId) !== Number(task.organizationId)
      )
    ) {
      throw governanceForbidden("Workflow task access denied.");
    }

    const body = await request.json().catch(() => ({}));

    const item = await completeWorkflowTask({
      taskId,
      result: body?.result || "COMPLETED",
      notes: body?.notes || null,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error: any) {
    const authResponse = governanceAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to complete task.") },
      { status: 500 },
    );
  }
}

