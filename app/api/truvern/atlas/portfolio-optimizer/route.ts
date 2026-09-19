import { NextResponse } from "next/server";
import { getRefactoringPortfolio } from "@/lib/atlas/portfolio-optimizer";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireOpsAccess();
  try {
    return NextResponse.json(getRefactoringPortfolio(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ATLAS Portfolio Optimizer failed." },
      { status: 500 },
    );
  }
}
