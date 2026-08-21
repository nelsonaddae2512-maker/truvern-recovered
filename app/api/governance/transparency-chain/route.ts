import { NextResponse } from "next/server";
import { findGovernanceTransparencyLogs } from "@/lib/repositories/governance-transparency-log-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET() {
  try {
    const rows = await findGovernanceTransparencyLogs({
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
      orderBy: [
        { timestamp: "asc" },
        { id: "asc" },
      ],
    });

    const issues: Array<{
      index: number;
      entryId: string | null;
      issue: string;
    }> = [];

    let previousEntryHash: string | null = null;

    rows.forEach((row, index) => {
      const entryId = safeStr(row.entryId) || null;
      const rowPreviousEntryHash =
        safeStr(row.previousEntryHash) || null;

      if (!safeStr(row.entryHash)) {
        issues.push({
          index,
          entryId,
          issue: "Missing entryHash.",
        });
      }

      if (!safeStr(row.ledgerHash)) {
        issues.push({
          index,
          entryId,
          issue: "Missing ledgerHash.",
        });
      }

      if (!safeStr(row.checksum)) {
        issues.push({
          index,
          entryId,
          issue: "Missing checksum.",
        });
      }

      if (!safeStr(row.receiptId)) {
        issues.push({
          index,
          entryId,
          issue: "Missing receiptId.",
        });
      }

      if (index === 0) {
        if (rowPreviousEntryHash) {
          issues.push({
            index,
            entryId,
            issue:
              "First chain entry should not have previousEntryHash.",
          });
        }
      } else if (rowPreviousEntryHash !== previousEntryHash) {
        issues.push({
          index,
          entryId,
          issue:
            "previousEntryHash does not match prior entryHash.",
        });
      }

      previousEntryHash = safeStr(row.entryHash) || null;
    });

    return NextResponse.json(
      {
        ok: true,
        chainVersion: "TRV-TRANSPARENCY-CHAIN-1.0",
        verified: issues.length === 0,
        entryCount: rows.length,
        latestEntryHash:
          rows.length > 0
            ? safeStr(rows[rows.length - 1]?.entryHash) || null
            : null,
        issues,
        entries: rows,
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
        verified: false,
        error:
          safeStr(error?.message) ||
          "Failed to verify transparency chain.",
      },
      { status: 500 },
    );
  }
}

