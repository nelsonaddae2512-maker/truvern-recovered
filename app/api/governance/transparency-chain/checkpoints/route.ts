import { NextResponse } from "next/server";
import { findGovernanceTransparencyCheckpoints } from "@/lib/repositories/governance-transparency-checkpoint-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET() {
  try {
    const rows = await findGovernanceTransparencyCheckpoints({
      orderBy: [
        { generatedAt: "desc" },
        { id: "desc" },
      ],
      take: 50,
    });

    return NextResponse.json(
      {
        ok: true,
        count: rows.length,
        checkpoints: rows,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          safeStr(error?.message) ||
          "Failed to read transparency checkpoints.",
      },
      { status: 500 },
    );
  }
}

