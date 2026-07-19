import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ receiptId: string }>;
};

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const params = await ctx.params;
    const receiptId = safeStr(params?.receiptId);

    if (!receiptId) {
      return NextResponse.json(
        { ok: false, error: "Invalid receipt id." },
        { status: 400 },
      );
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        id,
        "entryId",
        "assignmentId",
        "responseId",
        checksum,
        "ledgerHash",
        "receiptId",
        timestamp,
        "previousEntryHash",
        "entryHash",
        "createdAt"
      from "GovernanceTransparencyLog"
      where "receiptId" = $1
      limit 1
      `,
      receiptId,
    );

    const entry = rows?.[0] ?? null;

    if (!entry) {
      return NextResponse.json(
        {
          ok: false,
          found: false,
          receiptId,
          error: "Receipt not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        found: true,
        receiptId,
        entry,
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
          "Failed to look up governance receipt.",
      },
      { status: 500 },
    );
  }
}

