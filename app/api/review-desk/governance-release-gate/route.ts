import { NextResponse } from "next/server";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { runGovernanceReleaseGateEngine } from "@/lib/workflow/governance-release-gate-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await requireOpsAccess();
    const result = await runGovernanceReleaseGateEngine();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Governance release gate failed.") },
      { status: 500 },
    );
  }
}

