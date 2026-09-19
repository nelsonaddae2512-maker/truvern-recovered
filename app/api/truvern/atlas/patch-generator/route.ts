import { NextResponse } from "next/server";
import { getPatchPlan } from "@/lib/atlas/patch-generator";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireOpsAccess();
  try {
    return NextResponse.json(getPatchPlan(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ATLAS Patch Generator failed." },
      { status: 500 },
    );
  }
}
