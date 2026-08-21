import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import {
  signGovernancePayload,
} from "@/lib/governance-signature";
import {
  persistGovernanceDailyAnchorIfAbsent,
  readGovernanceDailyAnchorByDate,
} from "@/lib/repositories/governance-daily-anchor-repository";
import { findGovernanceTransparencyLogs } from "@/lib/repositories/governance-transparency-log-repository";

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

function isValidDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parsePersistedPayload(canonicalPayload: string) {
  const parsed =
    JSON.parse(canonicalPayload) as unknown;

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      "Persisted governance daily anchor payload is invalid.",
    );
  }

  return parsed as Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  try {
    const date =
      safeStr(new URL(request.url).searchParams.get("date")) ||
      new Date().toISOString().slice(0, 10);

    if (!isValidDateOnly(date)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid date. Expected YYYY-MM-DD.",
        },
        {
          status: 400,
        },
      );
    }

    const dayStart =
      new Date(`${date}T00:00:00.000Z`);

    if (Number.isNaN(dayStart.getTime())) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid date.",
        },
        {
          status: 400,
        },
      );
    }

    const normalizedDate =
      dayStart.toISOString().slice(0, 10);

    if (normalizedDate !== date) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid calendar date.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Immutable-first behavior:
     *
     * Once a UTC date has been anchored, the persisted canonical
     * payload and signature are the authoritative historical artifact.
     *
     * Do not regenerate generatedAt, Merkle data, or signatures for
     * an already-anchored date.
     */
    const persisted =
      await readGovernanceDailyAnchorByDate(
        dayStart,
      );

    if (persisted) {
      const payload =
        parsePersistedPayload(
          persisted.canonicalPayload,
        );

      return NextResponse.json({
        ok: true,
        anchored: true,
        persisted: true,
        created: false,
        anchor: {
          ...payload,
          signature: {
            algorithm:
              persisted.signatureAlgorithm,
            keyId:
              persisted.publicKeyId,
            value:
              persisted.signature,
            payloadHash:
              persisted.payloadHash,
          },
        },
        entries: [],
      });
    }

    const dayEnd =
      new Date(
        dayStart.getTime() +
          24 * 60 * 60 * 1000,
      );

    const rows =
      await findGovernanceTransparencyLogs({
        where: {
          timestamp: {
            gte: dayStart,
            lt: dayEnd,
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
          id: "asc",
        },
      });

    const leaves =
      rows.map((row) =>
        JSON.stringify({
          id: row.id,
          receiptId: row.receiptId,
          assignmentId: row.assignmentId,
          responseId: row.responseId,
          checksum: row.checksum,
          entryHash: row.entryHash,
          previousEntryHash:
            row.previousEntryHash,
          timestamp: row.timestamp,
        }),
      );

    const root =
      merkleRoot(leaves);

    if (!root) {
      return NextResponse.json({
        ok: true,
        anchored: false,
        persisted: false,
        created: false,
        date,
        entryCount: 0,
        message:
          "No transparency entries found for this date.",
      });
    }

    /*
     * generatedAt belongs inside the signed payload.
     * It is generated exactly once for a newly anchored day.
     */
    const generatedAt =
      new Date();

    const payload = {
      anchorType:
        "TRUVERN_DAILY_GOVERNANCE_MERKLE_ROOT",
      date,
      entryCount:
        rows.length,
      merkleRoot:
        root,
      generatedAt:
        generatedAt.toISOString(),
      version:
        "TRV-MERKLE-ANCHOR-1.0",
    };

    const canonicalPayload =
      JSON.stringify(payload);

    const cryptographicSignature =
      signGovernancePayload(payload);

    const payloadHash =
      cryptographicSignature.payloadHash ||
      sha256(canonicalPayload);

    const signedAt =
      new Date(
        cryptographicSignature.signedAt,
      );

    if (Number.isNaN(signedAt.getTime())) {
      throw new Error(
        "Governance signing service returned an invalid signedAt timestamp.",
      );
    }

    const persistence =
      await persistGovernanceDailyAnchorIfAbsent({
        anchorDate:
          dayStart,
        anchorType:
          payload.anchorType,
        version:
          payload.version,
        entryCount:
          payload.entryCount,
        merkleRoot:
          payload.merkleRoot,
        canonicalPayload,
        payloadHash,
        signature:
          cryptographicSignature.signature,
        signatureAlgorithm:
          cryptographicSignature.algorithm,
        publicKeyId:
          cryptographicSignature.keyId,
        signedAt,
        generatedAt,
      });

    /*
     * A concurrent request may have won the UNIQUE(anchorDate)
     * race. The repository returns the winner when the immutable
     * content matches.
     *
     * Always render the persisted row rather than reconstructing
     * the response from transient values.
     */
    const stored =
      persistence.anchor;

    const storedPayload =
      parsePersistedPayload(
        stored.canonicalPayload,
      );

    return NextResponse.json({
      ok: true,
      anchored: true,
      persisted: true,
      created:
        persistence.created,
      anchor: {
        ...storedPayload,
        signature: {
          algorithm:
            stored.signatureAlgorithm,
          keyId:
            stored.publicKeyId,
          value:
            stored.signature,
          payloadHash:
            stored.payloadHash,
        },
      },
      entries:
        persistence.created
          ? rows.map((row) => ({
              id: row.id,
              receiptId: row.receiptId,
              assignmentId:
                row.assignmentId,
              entryHash:
                row.entryHash,
            }))
          : [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          safeStr(error?.message) ||
          "Failed to generate daily anchor.",
      },
      {
        status: 500,
      },
    );
  }
}