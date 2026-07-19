import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const resolved = await context.params;
  const id = safeStr(resolved?.id);

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing manifest id" },
      { status: 400 },
    );
  }

  const numericId = Number(id);

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    select
      gtl.id,
      gtl."receiptId",
      gtl."assignmentId",
      gtl."responseId",
      gtl.checksum,
      gtl."entryHash",
      gtl."previousEntryHash",
      gtl.timestamp,
      gtl."createdAt"
    from "GovernanceTransparencyLog" gtl
    where gtl."receiptId" = $1
       or gtl."assignmentId" = $2
       or gtl.id = $2
    order by gtl."createdAt" desc
    limit 1
    `,
    id,
    Number.isFinite(numericId) ? numericId : -1,
  );

  const entry = rows[0];

  if (!entry) {
    return NextResponse.json(
      {
        ok: false,
        error: "Governance manifest not found",
        manifestId: id,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    manifest: {
      version: "TRV-MANIFEST-1.0",
      receiptId: entry.receiptId,
      assignmentId: entry.assignmentId,
      responseId: entry.responseId,
      checksum: entry.checksum,
      entryHash: entry.entryHash,
      previousEntryHash: entry.previousEntryHash,
      timestamp: entry.timestamp,
      generatedAt: new Date().toISOString(),
      immutable: true,
    },
  });
}


