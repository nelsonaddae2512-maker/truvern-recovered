import { NextResponse } from "next/server";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import {
  getSemanticRepositoryIntelligence,
  refreshSemanticRepositoryIntelligence,
} from "@/lib/atlas/semantic-intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireOpsAccess();
  try {
    return NextResponse.json(getSemanticRepositoryIntelligence(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Semantic intelligence failed." },
      { status: 500 },
    );
  }
}

export async function POST() {
  await requireOpsAccess();
  try {
    return NextResponse.json(refreshSemanticRepositoryIntelligence());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Semantic refresh failed." },
      { status: 500 },
    );
  }
}
