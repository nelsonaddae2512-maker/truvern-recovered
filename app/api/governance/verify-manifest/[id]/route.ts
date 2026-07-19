import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  buildSignedGovernanceManifest,
  verifySignedGovernanceManifest,
} from "@/lib/governance/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const resolved = await context.params;
    const id = safeStr(resolved?.id);
    const numericId = Number(id);

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing manifest id" },
        { status: 400 },
      );
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        gm.*
      from "GovernanceReleaseManifest" gm
      left join "GovernanceTransparencyLog" gtl
        on gtl."assignmentId" = gm."reviewAssignmentId"
      where gm.id = $2
         or gm."reviewAssignmentId" = $2
         or gtl."receiptId" = $1
      order by gm."createdAt" desc
      limit 1
      `,
      id,
      Number.isFinite(numericId) ? numericId : -1,
    );

    const manifestRow = rows[0];

    if (!manifestRow) {
      return NextResponse.json(
        {
          ok: false,
          error: "Signed governance manifest not found",
          manifestId: id,
        },
        { status: 404 },
      );
    }

    const immutableSnapshot = manifestRow.immutableSnapshot || {};
    const signature =
      immutableSnapshot.signature ||
      immutableSnapshot.governanceSeal?.signature ||
      null;

    const publicKeyFingerprint =
      immutableSnapshot.publicKeyFingerprint ||
      immutableSnapshot.governanceSeal?.publicKeyFingerprint ||
      null;

    const backfilledManifest =
      signature
        ? immutableSnapshot
        : buildSignedGovernanceManifest({
            organizationId: manifestRow.organizationId,
            vendorId: manifestRow.vendorId,
            assessmentRunId: manifestRow.assessmentRunId,
            reviewAssignmentId: manifestRow.reviewAssignmentId,
            reviewResponseId: manifestRow.reviewResponseId,
            releaseState: manifestRow.releaseState,
            reviewerName: manifestRow.reviewerName,
            releasedAt: manifestRow.releasedAt,
            confirmedAt: manifestRow.confirmedAt,
            finalizedAt: manifestRow.finalizedAt,
            packetChecksum: manifestRow.packetChecksum,
            fundingChecksum: manifestRow.fundingChecksum,
            snapshot: immutableSnapshot,
          });

    const verified =
      verifySignedGovernanceManifest(backfilledManifest);

    return NextResponse.json({
      ok: true,
      verified,
      manifest: {
        id: manifestRow.id,
        reviewAssignmentId: manifestRow.reviewAssignmentId,
        reviewResponseId: manifestRow.reviewResponseId,
        checksum: manifestRow.checksum,
        releaseState: manifestRow.releaseState,
        createdAt: manifestRow.createdAt,
        signatureAlgorithm:
          backfilledManifest.signature?.algorithm || null,
        publicKeyFingerprint:
          backfilledManifest.publicKeyFingerprint || publicKeyFingerprint,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message) || "Failed to verify signed manifest.",
      },
      { status: 500 },
    );
  }
}



