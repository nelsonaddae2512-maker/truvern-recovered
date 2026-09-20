import { currentUser } from "@clerk/nextjs/server";
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
import { claimWorkflowTask } from "@/lib/workflow/workflow-task-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function reviewerDisplayName(
  user: Awaited<ReturnType<typeof currentUser>>,
) {
  const fullName = user?.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  const combined =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

  if (combined) {
    return combined;
  }

  return (
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    "Internal reviewer"
  );
}

export async function POST(_request: Request, props: Props) {
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

    const clerkUser = await currentUser();
    const reviewerName = reviewerDisplayName(clerkUser);

    const item = await claimWorkflowTask({
      taskId,
      reviewerId: actor.userId,
      reviewerName,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error: any) {
    const authResponse = governanceAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to claim task.") },
      { status: 500 },
    );
  }
}

