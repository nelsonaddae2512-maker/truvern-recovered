import { NextResponse } from "next/server";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { runAiReviewWorker } from "@/lib/workflow/ai-review-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await requireOpsAccess();
    const result = await runAiReviewWorker();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "AI review worker failed.") },
      { status: 500 },
    );
  }
}

