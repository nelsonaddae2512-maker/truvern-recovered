import { NextRequest, NextResponse } from "next/server";

import {
  buildSignedGovernanceManifest,
  verifySignedGovernanceManifest,
} from "@/lib/governance/manifest";
import { findGovernanceTransparencyLogs } from "@/lib/repositories/governance-transparency-log-repository";
import { findGovernanceReleaseManifest } from "@/lib/repositories/review-release-repository";

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

    const receiptEntries = await findGovernanceTransparencyLogs({
      where: {
        receiptId: id,
      },
      select: {
        assignmentId: true,
      },
    });

    const receiptAssignmentIds = Array.from(
      new Set(receiptEntries.map((entry) => entry.assignmentId)),
    );

    const numericLookupId = Number.isFinite(numericId)
      ? numericId
      : -1;

    const manifestRow = await findGovernanceReleaseManifest({
      where: {
        OR: [
          { id: numericLookupId },
          { reviewAssignmentId: numericLookupId },
          ...(receiptAssignmentIds.length > 0
            ? [
                {
                  reviewAssignmentId: {
                    in: receiptAssignmentIds,
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
    });

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

    type GovernanceManifestSnapshot =
      Parameters<typeof buildSignedGovernanceManifest>[0]["snapshot"];

    type BuiltGovernanceManifest =
      ReturnType<typeof buildSignedGovernanceManifest>;

    const immutableSnapshot =
      (
        manifestRow.immutableSnapshot &&
        typeof manifestRow.immutableSnapshot === "object" &&
        !Array.isArray(manifestRow.immutableSnapshot)
          ? manifestRow.immutableSnapshot
          : {}
      ) as GovernanceManifestSnapshot;

    const storedSignedManifest =
      immutableSnapshot as unknown as BuiltGovernanceManifest;

    const signatureView = immutableSnapshot as GovernanceManifestSnapshot & {
      signature?: string | null;
      publicKeyFingerprint?: string | null;
      governanceSeal?: {
        signature?: string | null;
        publicKeyFingerprint?: string | null;
      } | null;
    };

    const signature =
      signatureView.signature ||
      signatureView.governanceSeal?.signature ||
      null;

    const publicKeyFingerprint =
      signatureView.publicKeyFingerprint ||
      signatureView.governanceSeal?.publicKeyFingerprint ||
      null;

    const backfilledManifest =
      signature
        ? storedSignedManifest
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



