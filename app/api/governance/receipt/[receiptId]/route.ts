import { NextResponse } from "next/server";
import { findFirstGovernanceTransparencyLog } from "@/lib/repositories/governance-transparency-log-repository";

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

    const entry = await findFirstGovernanceTransparencyLog({
      where: {
        receiptId,
      },
      select: {
        id: true,
        entryId: true,
        assignmentId: true,
        responseId: true,
        checksum: true,
        ledgerHash: true,
        receiptId: true,
        timestamp: true,
        previousEntryHash: true,
        entryHash: true,
        createdAt: true,
      },
    });

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

