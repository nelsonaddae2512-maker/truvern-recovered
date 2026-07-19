import { NextResponse } from "next/server";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { runWorkflowScheduler } from "@/lib/workflow/workflow-scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await requireOpsAccess();
    const result = await runWorkflowScheduler();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Workflow scheduler failed.") },
      { status: 500 },
    );
  }
}

