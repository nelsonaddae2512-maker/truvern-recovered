import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
      select *
      from "GovernanceTransparencyCheckpoint"
      order by "generatedAt" desc, id desc
      limit 50
      `,
    );

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

