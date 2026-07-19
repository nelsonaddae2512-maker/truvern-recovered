import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getEvidenceManifestForReview } from "@/lib/evidence/queries";
import { requireDbOrganization } from "@/lib/org-db";
import {
  canonicalizeGovernancePayload,
  signGovernancePayload,
  exportGovernancePublicKey,
} from "@/lib/governance/signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "cache-control": "no-store" } },
      ),
    };
  }

  try {
    const org = await requireDbOrganization();

    return {
      ok: true as const,
      userId,
      org,
    };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Organization required" },
        { status: 403, headers: { "cache-control": "no-store" } },
      ),
    };
  }
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function GET(req: Request, ctx: RouteContext) {
  try {
    const gate = await requireApiAuth();

    if (!gate.ok) {
      return gate.response;
    }
const params = await ctx.params;
    const assignmentId = safeInt(params?.id);

    if (!assignmentId) {
      return NextResponse.json(
        { ok: false, error: "Invalid assignment id." },
        { status: 400 },
      );
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        ra.id as "assignmentId",
        rr.id as "responseId",
        rr.responses,
        v.id as "vendorId",
        v.name as "vendorName"
      from "ReviewAssignment" ra
      left join "ReviewResponse" rr
        on rr."reviewAssignmentId" = ra.id
      left join "ReviewRequest" req
        on req.id = ra."reviewRequestId"
      left join "Vendor" v
        on v.id = req."vendorId"
      where ra.id = $1
      order by rr."updatedAt" desc nulls last
      limit 1
      `,
      assignmentId,
    );

    const row = rows?.[0];

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Assignment not found." },
        { status: 404 },
      );
    }

    const responses =
      row.responses && typeof row.responses === "object"
        ? row.responses
        : {};

    const snapshot =
      responses?.governanceReleaseSnapshot &&
      typeof responses.governanceReleaseSnapshot === "object"
        ? responses.governanceReleaseSnapshot
        : null;

    const seal =
      snapshot?.governanceSeal &&
      typeof snapshot.governanceSeal === "object"
        ? snapshot.governanceSeal
        : responses?.governanceSeal || {};

    const origin = new URL(req.url).origin;
    const basePath = `/review-desk/reviews/${assignmentId}`;

    const evidenceManifest = await getEvidenceManifestForReview(assignmentId);

    const manifestPayload = {
      assignmentId,
      responseId: row.responseId,
      vendorId: snapshot?.vendorId ?? row.vendorId ?? null,
      vendorName: snapshot?.vendorName ?? row.vendorName ?? null,
      checksum: safeStr(seal?.checksum) || null,
      sealedAt:
        snapshot?.governanceSeal?.sealedAt ||
        seal?.sealedAt ||
        snapshot?.releasedAt ||
        null,
      releaseState:
        safeStr(snapshot?.releaseState) ||
        safeStr(responses.releaseState) ||
        null,
    };

    const signature =
      signGovernancePayload(manifestPayload);

    return NextResponse.json(
      {
        ok: true,

        bundleVersion: "TRV-VERIFY-BUNDLE-1.0",

        generatedAt: new Date().toISOString(),

        manifest: manifestPayload,

        signature,

        canonicalPayload:
          canonicalizeGovernancePayload(
            manifestPayload,
          ),

        publicKey:
          exportGovernancePublicKey(),

        evidenceManifest,
        artifacts: {
          htmlPacketUrl: `${origin}${basePath}/packet`,
          pdfPacketUrl: `${origin}${basePath}/packet/pdf`,
          verifyUrl: `${origin}/api/review-desk/reviews/${assignmentId}/verify-seal`,
          manifestUrl: `${origin}/api/review-desk/reviews/${assignmentId}/release-manifest`,
          evidenceManifestUrl: `${origin}/api/review-desk/reviews/${assignmentId}/evidence-manifest`,
        },

        verificationInstructions: [
          "1. Recompute canonical payload serialization.",
          "2. Verify SHA-256 checksum integrity.",
          "3. Verify detached Ed25519 signature.",
          "4. Confirm checksum matches released governance packet.",
          "5. Confirm public key belongs to Truvern Governance Systems.",
        ],

        offlineVerificationSupported: true,
      },
      {
        headers: {
          "cache-control": "no-store",
          "content-disposition": `attachment; filename="truvern-verification-bundle-${assignmentId}.json"`,
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          safeStr(error?.message) ||
          "Failed to generate verification bundle.",
      },
      { status: 500 },
    );
  }
}





