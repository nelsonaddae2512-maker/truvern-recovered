import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createTransparencyChainCheckpoint } from "@/lib/governance/chain-checkpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET() {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        "entryHash",
        timestamp,
        id
      from "GovernanceTransparencyLog"
      order by timestamp asc, id asc
      `,
    );

    const entryHashes = rows
      .map((row) => safeStr(row.entryHash))
      .filter(Boolean);

    const latestEntryHash =
      entryHashes.length > 0
        ? entryHashes[entryHashes.length - 1]
        : null;

    const checkpoint =
      createTransparencyChainCheckpoint({
        entryHashes,
        latestEntryHash,
      });

    return NextResponse.json(
      {
        ok: true,
        ...checkpoint,
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
          "Failed to generate transparency chain checkpoint.",
      },
      { status: 500 },
    );
  }
}

