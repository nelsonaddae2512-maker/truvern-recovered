import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signGovernancePayload } from "@/lib/governance-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeInt(value: unknown) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const params = await ctx.params;
  const assignmentId = safeInt(params?.id);

  if (!assignmentId) {
    return NextResponse.json(
      { ok: false, error: "Invalid review assignment id." },
      { status: 400 },
    );
  }

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    select
      ra.id as "assignmentId",
      ra."organizationId",
      rr.id as "responseId",
      rr.responses,
      v.id as "vendorId",
      v.name as "vendorName"
    from "ReviewAssignment" ra
    join "ReviewResponse" rr on rr."reviewAssignmentId" = ra.id
    left join "ReviewRequest" req on req.id = ra."reviewRequestId"
    left join "Vendor" v on v.id = req."vendorId"
    where ra.id = $1
    order by rr."updatedAt" desc
    limit 1
    `,
    assignmentId,
  );

  const row = rows?.[0];

  if (!row) {
    return NextResponse.json(
      { ok: false, error: "Review release not found." },
      { status: 404 },
    );
  }

  const responses =
    row.responses && typeof row.responses === "object" ? row.responses : {};

  const snapshot =
    responses.governanceReleaseSnapshot &&
    typeof responses.governanceReleaseSnapshot === "object"
      ? responses.governanceReleaseSnapshot
      : {};

  const seal =
    snapshot.governanceSeal && typeof snapshot.governanceSeal === "object"
      ? snapshot.governanceSeal
      : responses.governanceSeal || {};

  if (safeStr(responses.releaseState) !== "CONFIRMED") {
    return NextResponse.json(
      { ok: false, error: "Only confirmed releases can issue attestations." },
      { status: 409 },
    );
  }

  const checksum = safeStr(seal.checksum);

  if (!checksum) {
    return NextResponse.json(
      { ok: false, error: "Confirmed release is missing checksum." },
      { status: 409 },
    );
  }

  const attestation = {
    schema: "truvern.governance_attestation.v1",
    releaseId: `TRV-REL-${assignmentId}`,
    assignmentId,
    responseId: Number(row.responseId),
    organizationId: Number(row.organizationId),
    vendorId: row.vendorId ? Number(row.vendorId) : null,
    vendorName: safeStr(row.vendorName) || safeStr(snapshot.vendorName),
    releaseState: "CONFIRMED",
    decision: safeStr(snapshot.decision) || safeStr(responses.decision),
    residualRisk: safeStr(snapshot.riskLevel) || safeStr(responses.riskLevel),
    checksum,
    sealedAt: safeStr(seal.sealedAt) || safeStr(snapshot.releasedAt),
    manifestVersion: "TRV-ATTESTATION-1.0",
  };

  const signature = signGovernancePayload(attestation);

  return NextResponse.json(
    {
      ok: true,
      attestation,
      signature,
      verification: {
        checksum,
        verifier: `/api/review-desk/reviews/${assignmentId}/verify-seal`,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
