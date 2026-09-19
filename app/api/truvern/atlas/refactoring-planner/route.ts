import { NextResponse } from "next/server";

import { getRefactoringPlanner } from "@/lib/atlas/refactoring-planner";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireOpsAccess();
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
