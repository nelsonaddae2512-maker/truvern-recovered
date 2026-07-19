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

function buildMerkleProof(leaves: string[], targetIndex: number) {
  let level = leaves.map((leaf) => sha256(leaf));
  let index = targetIndex;
  const proof: Array<{ position: "left" | "right"; hash: string }> = [];

  while (level.length > 1) {
    const next: string[] = [];

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;

      if (i === index || i + 1 === index) {
        const isLeft = index === i;

        proof.push({
          position: isLeft ? "right" : "left",
          hash: isLeft ? right : left,
        });

        index = Math.floor(i / 2);
      }

      next.push(sha256(`${left}${right}`));
    }

    level = next;
  }

  return {
    root: level[0] || null,
    proof,
  };
}

function verifyProof(leaf: string, proof: Array<{ position: "left" | "right"; hash: string }>) {
  let computed = sha256(leaf);

  for (const step of proof) {
    computed =
      step.position === "left"
        ? sha256(`${step.hash}${computed}`)
        : sha256(`${computed}${step.hash}`);
  }

  return computed;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ receiptId: string }> | { receiptId: string } },
) {
  try {
    const resolved = await context.params;
    const receiptId = safeStr(resolved?.receiptId);

    if (!receiptId) {
      return NextResponse.json(
        { ok: false, error: "Missing receipt id" },
        { status: 400 },
      );
    }

    const targetRows: any[] = await prisma.$queryRawUnsafe(
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
      where "receiptId" = $1
      limit 1
      `,
      receiptId,
    );

    const target = targetRows[0];

    if (!target) {
      return NextResponse.json(
        { ok: false, error: "Receipt not found", receiptId },
        { status: 404 },
      );
    }

    const date = new Date(target.timestamp).toISOString().slice(0, 10);

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

    const targetIndex = rows.findIndex((row) => row.receiptId === receiptId);

    if (targetIndex < 0) {
      return NextResponse.json(
        { ok: false, error: "Receipt not found in daily anchor set", receiptId },
        { status: 404 },
      );
    }

    const { root, proof } = buildMerkleProof(leaves, targetIndex);
    const recomputedRoot = verifyProof(leaves[targetIndex], proof);
    const inclusionVerified = !!root && root === recomputedRoot;

    const anchorPayload = {
      anchorType: "TRUVERN_DAILY_GOVERNANCE_MERKLE_ROOT",
      date,
      entryCount: rows.length,
      merkleRoot: root,
      version: "TRV-MERKLE-ANCHOR-1.0",
    };

    const publicKeyPath =
      process.env.TRUVERN_SIGNING_PUBLIC_KEY_PATH ||
      path.join(process.cwd(), "certs", "truvern-public.pem");

    const publicKey = fs.readFileSync(publicKeyPath, "utf8");

    return NextResponse.json({
      ok: true,
      receiptId,
      date,
      inclusionVerified,
      merkleRoot: root,
      target: {
        index: targetIndex,
        leafHash: sha256(leaves[targetIndex]),
        assignmentId: target.assignmentId,
        responseId: target.responseId,
        entryHash: target.entryHash,
        checksum: target.checksum,
      },
      proof,
      anchor: {
        ...anchorPayload,
        publicKeyFingerprint: sha256(publicKey),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message) || "Failed to generate inclusion proof.",
      },
      { status: 500 },
    );
  }
}


