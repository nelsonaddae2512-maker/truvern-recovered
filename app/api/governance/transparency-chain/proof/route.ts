import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createTransparencyChainCheckpoint } from "@/lib/governance/chain-checkpoint";

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
    const entries: any[] = await prisma.$queryRawUnsafe(
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
      order by timestamp asc, id asc
      `,
    );

    const issues: Array<{
      index: number;
      entryId: string | null;
      issue: string;
    }> = [];

    let previousEntryHash: string | null = null;

    entries.forEach((entry, index) => {
      const entryId = safeStr(entry.entryId) || null;
      const rowPreviousEntryHash =
        safeStr(entry.previousEntryHash) || null;

      if (!safeStr(entry.entryHash)) {
        issues.push({ index, entryId, issue: "Missing entryHash." });
      }

      if (!safeStr(entry.ledgerHash)) {
        issues.push({ index, entryId, issue: "Missing ledgerHash." });
      }

      if (!safeStr(entry.checksum)) {
        issues.push({ index, entryId, issue: "Missing checksum." });
      }

      if (!safeStr(entry.receiptId)) {
        issues.push({ index, entryId, issue: "Missing receiptId." });
      }

      if (index === 0) {
        if (rowPreviousEntryHash) {
          issues.push({
            index,
            entryId,
            issue: "Genesis entry should not have previousEntryHash.",
          });
        }
      } else if (rowPreviousEntryHash !== previousEntryHash) {
        issues.push({
          index,
          entryId,
          issue: "previousEntryHash does not match prior entryHash.",
        });
      }

      previousEntryHash = safeStr(entry.entryHash) || null;
    });

    const entryHashes = entries
      .map((entry) => safeStr(entry.entryHash))
      .filter(Boolean);

    const latestEntryHash =
      entryHashes.length > 0
        ? entryHashes[entryHashes.length - 1]
        : null;

    const checkpoint = createTransparencyChainCheckpoint({
      entryHashes,
      latestEntryHash,
    });

    return NextResponse.json(
      {
        ok: true,
        proofVersion: "TRV-CHAIN-PROOF-1.0",
        generatedAt: new Date().toISOString(),
        verified: issues.length === 0,
        entryCount: entries.length,
        latestEntryHash,
        checkpoint,
        issues,
        entries,
      },
      {
        headers: {
          "cache-control": "no-store",
          "content-disposition":
            'attachment; filename="truvern-transparency-chain-proof.json"',
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
          "Failed to generate transparency chain proof.",
      },
      { status: 500 },
    );
  }
}

