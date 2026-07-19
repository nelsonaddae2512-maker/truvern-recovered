import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import { emitWorkflowEvent } from "@/lib/workflow/workflow-events";
import { WorkflowEvent } from "@/lib/workflow/workflow-constants";

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
    const packageId = Number(resolved.id);
    const body = await request.json().catch(() => ({}));

    if (!Number.isFinite(packageId) || packageId <= 0) {
      return NextResponse.json({ ok: false, error: "Remediation package id required." }, { status: 400 });
    }

    const result = await emitWorkflowEvent({
      event: WorkflowEvent.PackageApproved,
      packageId,
      actor: body?.actor || "TRUVERN_REVIEWER",
      summary: body?.summary || "Truvern approved the remediation package.",
      payload: {
        rationale: body?.rationale || "",
        reviewerName: body?.reviewerName || null,
      },
    });

    return NextResponse.json({
      ...result,
      ok: true,
      packageId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to approve remediation package.") },
      { status: 500 },
    );
  }
}


