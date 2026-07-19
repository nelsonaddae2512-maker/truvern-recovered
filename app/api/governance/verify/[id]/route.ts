import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";

import prisma from "@/lib/prisma";

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

    const rows: Array<{
      assignmentId: number;
      vendorId: number | null;
      vendorName: string | null;
      responseId: number | null;
      responses: any;
    }> = await prisma.$queryRawUnsafe(
      `
      select
        ra.id as "assignmentId",
        ra."vendorId" as "vendorId",
        v.name as "vendorName",
        rr.id as "responseId",
        rr.responses as responses
      from "ReviewAssignment" ra
      left join "Vendor" v on v.id = ra."vendorId"
      left join "ReviewResponse" rr on rr."reviewAssignmentId" = ra.id
      where ra.id = $1
      order by rr."updatedAt" desc nulls last
      limit 1
      `,
      assignmentId,
    );

    const row = rows[0];

    if (!row) {
      return NextResponse.json({ ok: false, error: "Governance release not found" }, { status: 404 });
    }

    const responses = row.responses || {};
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

    const publicKeyPath =
      process.env.TRUVERN_SIGNING_PUBLIC_KEY_PATH ||
      path.join(process.cwd(), "certs", "truvern-public.pem");

    const publicKey = fs.readFileSync(publicKeyPath, "utf8");

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
        keyId: cryptographicSignature.keyId || null,
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




