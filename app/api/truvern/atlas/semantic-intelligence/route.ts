import { NextResponse } from "next/server";
import {
  getSemanticRepositoryIntelligence,
  refreshSemanticRepositoryIntelligence,
} from "@/lib/atlas/semantic-intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
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
  try {
    return NextResponse.json(refreshSemanticRepositoryIntelligence());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Semantic refresh failed." },
      { status: 500 },
    );
  }
}
