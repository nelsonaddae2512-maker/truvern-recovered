import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import { completeWorkflowTask } from "@/lib/workflow/workflow-task-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: Request, props: Props) {
  try {
    await requireReviewerAccess();
    const resolved = await props.params;
    const taskId = Number(resolved.id);
    const body = await request.json().catch(() => ({}));

    const item = await completeWorkflowTask({
      taskId,
      result: body?.result || "COMPLETED",
      notes: body?.notes || null,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to complete task.") },
      { status: 500 },
    );
  }
}

