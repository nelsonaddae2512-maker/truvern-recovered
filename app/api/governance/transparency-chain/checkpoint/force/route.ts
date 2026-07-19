import { NextResponse } from "next/server";
import { maybePersistTransparencyCheckpoint } from "@/lib/governance/auto-checkpoint-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST() {
  try {
    const result = await maybePersistTransparencyCheckpoint({
      force: true,
    });

    return NextResponse.json(
      {
        ok: true,
        forced: true,
        result,
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
        forced: true,
        error:
          safeStr(error?.message) ||
          "Failed to force transparency checkpoint.",
      },
      { status: 500 },
    );
  }
}

