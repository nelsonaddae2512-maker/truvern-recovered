import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import {
  getGovernanceSigningKey,
  readGovernancePublicKey,
} from "@/lib/governance-signing-keys";

import { findReviewAssignment } from "@/lib/repositories/review-assignment-repository";
import { findLatestReviewResponse } from "@/lib/repositories/review-response-repository";
import { findVendor } from "@/lib/repositories/vendor-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const assignmentId = Number(id);

    if (!Number.isFinite(assignmentId)) {
      return NextResponse.json({ ok: false, error: "Invalid assignment id" }, { status: 400 });
    }

    const assignment = await findReviewAssignment({
      where: {
        id: assignmentId,
      },
      select: {
        id: true,
        vendorId: true,
      },
    });

    const latestResponse = assignment
      ? await findLatestReviewResponse(assignmentId)
      : null;

    const vendor = assignment
      ? await findVendor({
          where: {
            id: assignment.vendorId,
          },
          select: {
            name: true,
          },
        })
      : null;

    const row = assignment
      ? {
          assignmentId: assignment.id,
          vendorId: assignment.vendorId,
          vendorName: vendor?.name ?? null,
          responseId: latestResponse?.id ?? null,
          responses: latestResponse?.responses ?? {},
        }
      : null;

    if (!row) {
      return NextResponse.json({ ok: false, error: "Governance release not found" }, { status: 404 });
    }

    const responses =
      row.responses &&
      typeof row.responses === "object" &&
      !Array.isArray(row.responses)
        ? (row.responses as Record<string, any>)
        : {};
    const governanceSeal = responses?.governanceSeal || {};
    const checksum = safeStr(governanceSeal.checksum);
    const cryptographicSignature = governanceSeal?.cryptographicSignature || {};
    const signature = safeStr(cryptographicSignature.signature);
    const algorithm = safeStr(cryptographicSignature.algorithm) || "RSA-SHA256";

    if (!signature || !checksum) {
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          error: "Release is missing cryptographic materials",
          release: {
            assignmentId: row.assignmentId,
            vendorId: row.vendorId,
            vendorName: row.vendorName,
            checksum: checksum || null,
            signed: Boolean(signature),
          },
        },
        { status: 400 },
      );
    }

    const canonicalPayload = JSON.stringify({
      assignmentId: row.assignmentId,
      responseId: row.responseId,
      organizationId: responses?.governanceReleaseSnapshot?.organizationId || null,
      vendorId: row.vendorId,
      vendorName: row.vendorName,
      checksum,
      confirmedAt: responses?.confirmedAt || null,
      releaseState: responses?.releaseState || null,
      manifestVersion: "TRV-MANIFEST-1.0",
    });
    const persistedKeyId =
      safeStr(cryptographicSignature.keyId);

    if (!persistedKeyId) {
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          error: "Release is missing governance signing key identity",
          release: {
            assignmentId: row.assignmentId,
            responseId: row.responseId,
            vendorId: row.vendorId,
            vendorName: row.vendorName,
            checksum,
            algorithm,
            keyId: null,
          },
        },
        { status: 400 },
      );
    }

    const resolvedKeyId =
      persistedKeyId;

    const signingKey =
      getGovernanceSigningKey(resolvedKeyId);

    if (!signingKey) {
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          error: "Unknown governance signing key",
          release: {
            assignmentId: row.assignmentId,
            responseId: row.responseId,
            vendorId: row.vendorId,
            vendorName: row.vendorName,
            checksum,
            algorithm,
            keyId: resolvedKeyId,
          },
        },
        { status: 400 },
      );
    }

    const publicKey =
      readGovernancePublicKey(signingKey.keyId);

    const payloadHash = safeStr(cryptographicSignature.payloadHash);

    const rebuiltPayloadHash = crypto
      .createHash("sha256")
      .update(canonicalPayload)
      .digest("hex");

    const verified =
      !!signature &&
      crypto.verify(
        "sha256",
        Buffer.from(canonicalPayload, "utf8"),
        publicKey,
        Buffer.from(signature, "base64"),
      );

    const payloadHashMatches = payloadHash
      ? payloadHash === rebuiltPayloadHash
      : null;

    return NextResponse.json({
      ok: true,
      verified,
      release: {
        assignmentId: row.assignmentId,
        responseId: row.responseId,
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        checksum,
        algorithm,
        sealedAt: governanceSeal.sealedAt || null,
        signedAt: cryptographicSignature.signedAt || null,
        keyId: resolvedKeyId,
      },
      attestation: {
        immutable: true,
        cryptographicallyVerified: verified,
        payloadHashMatches,
        storedPayloadHash: payloadHash || null,
        rebuiltPayloadHash,
        publicKeyFingerprint: crypto.createHash("sha256").update(publicKey).digest("hex"),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: safeStr(error?.message) || "Verification failed" },
      { status: 500 },
    );
  }
}






