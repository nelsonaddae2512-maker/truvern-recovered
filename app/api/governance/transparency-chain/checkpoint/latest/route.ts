import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select *
      from "GovernanceTransparencyCheckpoint"
      order by "generatedAt" desc, id desc
      limit 1
      `,
    );

    const checkpoint = rows?.[0] || null;

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

