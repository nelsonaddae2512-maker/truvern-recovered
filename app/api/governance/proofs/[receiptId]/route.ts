import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import {
  readGovernancePublicKey,
} from "@/lib/governance-signing-keys";
import {
  verifyGovernanceSignature,
} from "@/lib/governance-signature";
import {
  readGovernanceDailyAnchorByDate,
} from "@/lib/repositories/governance-daily-anchor-repository";
import {
  findGovernanceTransparencyLogs,
  findFirstGovernanceTransparencyLog,
} from "@/lib/repositories/governance-transparency-log-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function buildMerkleProof(
  leaves: string[],
  targetIndex: number,
) {
  let level =
    leaves.map((leaf) =>
      sha256(leaf),
    );

  let index =
    targetIndex;

  const proof: Array<{
    position: "left" | "right";
    hash: string;
  }> = [];

  while (level.length > 1) {
    const next: string[] = [];

    for (
      let i = 0;
      i < level.length;
      i += 2
    ) {
      const left =
        level[i];

      const right =
        level[i + 1] ||
        left;

      if (
        i === index ||
        i + 1 === index
      ) {
        const isLeft =
          index === i;

        proof.push({
          position:
            isLeft
              ? "right"
              : "left",
          hash:
            isLeft
              ? right
              : left,
        });

        index =
          Math.floor(i / 2);
      }

      next.push(
        sha256(
          `${left}${right}`,
        ),
      );
    }

    level =
      next;
  }

  return {
    root:
      level[0] ||
      null,
    proof,
  };
}

function verifyProof(
  leaf: string,
  proof: Array<{
    position: "left" | "right";
    hash: string;
  }>,
) {
  let computed =
    sha256(leaf);

  for (const step of proof) {
    computed =
      step.position === "left"
        ? sha256(
            `${step.hash}${computed}`,
          )
        : sha256(
            `${computed}${step.hash}`,
          );
  }

  return computed;
}

function parseCanonicalPayload(
  canonicalPayload: string,
) {
  const parsed =
    JSON.parse(
      canonicalPayload,
    ) as unknown;

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      "Persisted daily anchor canonical payload is invalid.",
    );
  }

  return parsed as Record<
    string,
    unknown
  >;
}

export async function GET(
  _req: NextRequest,
  context: {
    params:
      | Promise<{
          receiptId: string;
        }>
      | {
          receiptId: string;
        };
  },
) {
  try {
    const resolved =
      await context.params;

    const receiptId =
      safeStr(
        resolved?.receiptId,
      );

    if (!receiptId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing receipt id",
        },
        {
          status: 400,
        },
      );
    }

    const target =
      await findFirstGovernanceTransparencyLog({
        where: {
          receiptId,
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
        },
      });

    if (!target) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Receipt not found",
          receiptId,
        },
        {
          status: 404,
        },
      );
    }

    const date =
      new Date(
        target.timestamp,
      )
        .toISOString()
        .slice(0, 10);

    const dayStart =
      new Date(
        `${date}T00:00:00.000Z`,
      );

    const dayEnd =
      new Date(
        dayStart.getTime() +
          24 * 60 * 60 * 1000,
      );

    /*
     * Historical anchor identity is selected by the receipt's
     * UTC date—not by whichever signing key happens to be active
     * when the proof is requested.
     */
    const persistedAnchor =
      await readGovernanceDailyAnchorByDate(
        dayStart,
      );

    if (!persistedAnchor) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Persisted daily governance anchor not found for receipt date.",
          receiptId,
          date,
        },
        {
          status: 404,
        },
      );
    }

    const rows =
      await findGovernanceTransparencyLogs({
        where: {
          timestamp: {
            gte:
              dayStart,
            lt:
              dayEnd,
          },
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
        },
        orderBy: {
          id:
            "asc",
        },
      });

    const leaves =
      rows.map((row) =>
        JSON.stringify({
          id:
            row.id,
          receiptId:
            row.receiptId,
          assignmentId:
            row.assignmentId,
          responseId:
            row.responseId,
          checksum:
            row.checksum,
          entryHash:
            row.entryHash,
          previousEntryHash:
            row.previousEntryHash,
          timestamp:
            row.timestamp,
        }),
      );

    const targetIndex =
      rows.findIndex(
        (row) =>
          row.receiptId ===
          receiptId,
      );

    if (targetIndex < 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Receipt not found in daily anchor set",
          receiptId,
        },
        {
          status: 404,
        },
      );
    }

    const {
      root,
      proof,
    } =
      buildMerkleProof(
        leaves,
        targetIndex,
      );

    const recomputedRoot =
      verifyProof(
        leaves[targetIndex],
        proof,
      );

    const inclusionVerified =
      !!root &&
      root ===
        recomputedRoot;

    /*
     * The live reconstruction must match the immutable anchor
     * that was actually signed for this historical date.
     */
    const anchorRootMatches =
      !!root &&
      persistedAnchor.merkleRoot ===
        root;

    const anchorEntryCountMatches =
      persistedAnchor.entryCount ===
      rows.length;

    const canonicalPayload =
      parseCanonicalPayload(
        persistedAnchor.canonicalPayload,
      );

    /*
     * Verify the stored payload hash independently before checking
     * the RSA signature.
     */
    const rebuiltPayloadHash =
      sha256(
        persistedAnchor.canonicalPayload,
      );

    const payloadHashMatches =
      rebuiltPayloadHash ===
      persistedAnchor.payloadHash;

    /*
     * Critical C5 behavior:
     *
     * Verify using the key ID that was persisted when the anchor
     * was created. Never fall back to today's active key.
     */
    const anchorSignatureVerified =
      verifyGovernanceSignature(
        canonicalPayload,
        persistedAnchor.signature,
        persistedAnchor.publicKeyId,
      );

    const publicKey =
      readGovernancePublicKey(
        persistedAnchor.publicKeyId,
      );

    const publicKeyFingerprint =
      sha256(
        publicKey,
      );

    const anchorVerified =
      inclusionVerified &&
      anchorRootMatches &&
      anchorEntryCountMatches &&
      payloadHashMatches &&
      anchorSignatureVerified;

    return NextResponse.json({
      ok: true,
      receiptId,
      date,

      inclusionVerified,

      /*
       * Keep the existing top-level Merkle root field for
       * backward compatibility with the verification UI.
       */
      merkleRoot:
        root,

      target: {
        index:
          targetIndex,
        leafHash:
          sha256(
            leaves[
              targetIndex
            ],
          ),
        assignmentId:
          target.assignmentId,
        responseId:
          target.responseId,
        entryHash:
          target.entryHash,
        checksum:
          target.checksum,
      },

      proof,

      anchor: {
        anchorType:
          persistedAnchor.anchorType,
        date,
        entryCount:
          persistedAnchor.entryCount,
        merkleRoot:
          persistedAnchor.merkleRoot,
        version:
          persistedAnchor.version,
        generatedAt:
          persistedAnchor.generatedAt.toISOString(),
        signedAt:
          persistedAnchor.signedAt.toISOString(),

        keyId:
          persistedAnchor.publicKeyId,

        signatureAlgorithm:
          persistedAnchor.signatureAlgorithm,

        signature:
          persistedAnchor.signature,

        payloadHash:
          persistedAnchor.payloadHash,

        publicKeyFingerprint,

        verification: {
          verified:
            anchorVerified,

          inclusionVerified,

          merkleRootMatches:
            anchorRootMatches,

          entryCountMatches:
            anchorEntryCountMatches,

          payloadHashMatches,

          signatureVerified:
            anchorSignatureVerified,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          safeStr(
            error?.message,
          ) ||
          "Failed to generate inclusion proof.",
      },
      {
        status: 500,
      },
    );
  }
}