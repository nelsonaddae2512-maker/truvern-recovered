import { NextResponse } from "next/server";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { runWorkflowScheduler } from "@/lib/workflow/workflow-scheduler";
import { runWorkflowOrchestrator } from "@/lib/workflow/workflow-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await requireOpsAccess();
    const scheduler = await runWorkflowScheduler();
    const orchestrator = await runWorkflowOrchestrator();

    return NextResponse.json({
      ok: true,
      scheduler,
      orchestrator,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Workflow orchestrator failed.") },
      { status: 500 },
    );
  }
}

