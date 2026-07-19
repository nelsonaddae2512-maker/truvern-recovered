import { NextResponse } from "next/server";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { runReleaseReadinessEngine } from "@/lib/workflow/release-readiness-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await requireOpsAccess();
    const result = await runReleaseReadinessEngine();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Release readiness engine failed.") },
      { status: 500 },
    );
  }
}

