import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import { generateWorkflowTasksForPackage } from "@/lib/workflow/workflow-task-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(_request: Request, props: Props) {
  try {
    await requireReviewerAccess();
    const resolved = await props.params;
    const packageId = Number(resolved.id);

    if (!Number.isFinite(packageId) || packageId <= 0) {
      return NextResponse.json({ ok: false, error: "Package id required." }, { status: 400 });
    }

    const result = await generateWorkflowTasksForPackage({
      packageId,
      actor: "TRUVERN_REVIEWER",
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to generate workflow tasks.") },
      { status: 500 },
    );
  }
}

