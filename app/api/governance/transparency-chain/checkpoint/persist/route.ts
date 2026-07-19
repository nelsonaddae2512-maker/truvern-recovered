import { NextResponse } from "next/server";
import { persistTransparencyChainCheckpoint } from "@/lib/governance/persist-chain-checkpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST() {
  try {
    const checkpoint = await persistTransparencyChainCheckpoint();

    return NextResponse.json(
      {
        ok: true,
        checkpoint,
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
          "Failed to persist transparency checkpoint.",
      },
      { status: 500 },
    );
  }
}

