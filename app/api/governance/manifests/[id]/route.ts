import { NextRequest, NextResponse } from "next/server";

import { findFirstGovernanceTransparencyLog } from "@/lib/repositories/governance-transparency-log-repository";

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

  const numericLookupId = Number.isFinite(numericId)
    ? numericId
    : -1;

  const entry = await findFirstGovernanceTransparencyLog({
    where: {
      OR: [
        { receiptId: id },
        { assignmentId: numericLookupId },
        { id: numericLookupId },
      ],
    },
    select: {
      id: true,
      receiptId: true,
      assignmentId: true,
      responseId: true,
      checksum: true,
      entryHash: true,
      previousEntryHash: true,
      timestamp: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

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


