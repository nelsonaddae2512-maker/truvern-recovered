import { NextResponse } from "next/server";

import { getRefactoringPlanner } from "@/lib/atlas/refactoring-planner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getRefactoringPlanner(), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ATLAS Refactoring Planner failed.",
      },
      { status: 500 },
    );
  }
}
