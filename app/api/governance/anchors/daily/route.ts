import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";

import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function merkleRoot(leaves: string[]) {
  if (!leaves.length) return null;

  let level = leaves.map((leaf) => sha256(leaf));

  while (level.length > 1) {
    const next: string[] = [];

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;

      next.push(sha256(`${left}${right}`));
    }

    level = next;
  }

  return level[0];
}

export async function GET(request: NextRequest) {
  try {
    const date =
      safeStr(new URL(request.url).searchParams.get("date")) ||
      new Date().toISOString().slice(0, 10);

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        id,
        "receiptId",
        "assignmentId",
        "responseId",
        checksum,
        "entryHash",
        "previousEntryHash",
        timestamp
      from "GovernanceTransparencyLog"
      where date(timestamp) = $1::date
      order by id asc
      `,
      date,
    );

    const leaves = rows.map((row) =>
      JSON.stringify({
        id: row.id,
        receiptId: row.receiptId,
        assignmentId: row.assignmentId,
        responseId: row.responseId,
        checksum: row.checksum,
        entryHash: row.entryHash,
        previousEntryHash: row.previousEntryHash,
        timestamp: row.timestamp,
      }),
    );

    const root = merkleRoot(leaves);

    if (!root) {
      return NextResponse.json({
        ok: true,
        anchored: false,
        date,
        entryCount: 0,
        message: "No transparency entries found for this date.",
      });
    }

    const payload = {
      anchorType: "TRUVERN_DAILY_GOVERNANCE_MERKLE_ROOT",
      date,
      entryCount: rows.length,
      merkleRoot: root,
      generatedAt: new Date().toISOString(),
      version: "TRV-MERKLE-ANCHOR-1.0",
    };

    const privateKeyPath =
      process.env.TRUVERN_SIGNING_PRIVATE_KEY_PATH ||
      path.join(process.cwd(), "certs", "truvern-private.pem");

    const privateKey = fs.readFileSync(privateKeyPath, "utf8");
    const canonicalPayload = JSON.stringify(payload);

    const signature = crypto
      .sign("sha256", Buffer.from(canonicalPayload, "utf8"), privateKey)
      .toString("base64");

    return NextResponse.json({
      ok: true,
      anchored: true,
      anchor: {
        ...payload,
        signature: {
          algorithm: "RSA-SHA256",
          keyId: "truvern-governance-rsa-4096-v1",
          value: signature,
          payloadHash: sha256(canonicalPayload),
        },
      },
      entries: rows.map((row) => ({
        id: row.id,
        receiptId: row.receiptId,
        assignmentId: row.assignmentId,
        entryHash: row.entryHash,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message) || "Failed to generate daily anchor.",
      },
      { status: 500 },
    );
  }
}


