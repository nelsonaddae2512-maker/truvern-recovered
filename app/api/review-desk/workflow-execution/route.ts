import { NextResponse } from "next/server";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { runTruvernWorkflowExecution } from "@/lib/workflow/workflow-execution-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await requireOpsAccess();
    const result = await runTruvernWorkflowExecution();

    return NextResponse.json(result, {
      status: result.ok ? 200 : 500,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Workflow execution failed.") },
      { status: 500 },
    );
  }
}

