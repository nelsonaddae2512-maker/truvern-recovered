import { NextResponse } from "next/server";
import { getPatchPlan } from "@/lib/atlas/patch-generator";

export const dynamic = "force-dynamic";

export async function GET() {
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
