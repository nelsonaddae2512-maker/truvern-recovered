import { NextResponse } from "next/server";
import { findFirstGovernanceTransparencyCheckpoint } from "@/lib/repositories/governance-transparency-checkpoint-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  if (typeof v === "string") return v.trim();
  if (v instanceof Date) return v.toISOString();
  return "";
}

export async function GET() {
  try {
    const checkpoint = await findFirstGovernanceTransparencyCheckpoint({
      orderBy: [
        { generatedAt: "desc" },
        { id: "desc" },
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        found: !!checkpoint,
        checkpoint,
        trustAnchor: checkpoint
          ? {
              checkpointId: safeStr(checkpoint.checkpointId),
              checkpointHash: safeStr(checkpoint.checkpointHash),
              merkleRoot: safeStr(checkpoint.merkleRoot),
              latestEntryHash: safeStr(checkpoint.latestEntryHash),
              generatedAt: safeStr(checkpoint.generatedAt),
              signature: checkpoint.signature || null,
            }
          : null,
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
        found: false,
        error:
          safeStr(error?.message) ||
          "Failed to read latest transparency checkpoint.",
      },
      { status: 500 },
    );
  }
}

