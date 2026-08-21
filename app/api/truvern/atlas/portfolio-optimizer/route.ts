import { NextResponse } from "next/server";
import { getRefactoringPortfolio } from "@/lib/atlas/portfolio-optimizer";

export const dynamic = "force-dynamic";

export async function GET() {
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
