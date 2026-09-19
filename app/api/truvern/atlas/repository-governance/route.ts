import { NextResponse } from "next/server";

import { getRepositoryGovernance } from "@/lib/atlas/repository-governance";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireOpsAccess();
  try {
    return NextResponse.json(getRepositoryGovernance());
  } catch (error) {
    console.error("ATLAS Repository Governance failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ATLAS Repository Governance failed.",
      },
      { status: 500 },
    );
  }
}
