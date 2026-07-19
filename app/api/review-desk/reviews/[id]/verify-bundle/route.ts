import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

function safeInt(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

export async function GET(_request: Request, context: Props) {
  try {
    await requireReviewerAccess();
    const { id } = await context.params;
    const assignmentId = safeInt(id);

    if (!assignmentId) {
      return NextResponse.json(
        { ok: false, verified: false, error: "Invalid assignment id." },
        { status: 400 },
      );
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      select
        ra.id as "assignmentId",
        ra."vendorId",
        v.name as "vendorName",
        rr.id as "responseId",
        rr.responses
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
      return NextResponse.json(
        { ok: false, verified: false, error: "Assignment not found." },
        { status: 404 },
      );
    }

    const responses = safeObject(row.responses);
    const snapshot = safeObject(responses.governanceReleaseSnapshot);
    const seal = safeObject(snapshot.governanceSeal ?? responses.governanceSeal);

    const checksum = safeStr(seal.checksum);
    const snapshotPresent = Object.keys(snapshot).length > 0;
    const checksumPresent = !!checksum;

    return NextResponse.json(
      {
        ok: true,
        verified: checksumPresent && snapshotPresent,
        verificationTimestamp: new Date().toISOString(),

        assignmentId,
        responseId: row.responseId ?? null,
        vendorId: snapshot.vendorId ?? row.vendorId ?? null,
        vendorName: snapshot.vendorName ?? row.vendorName ?? null,

        checksumPresent,
        snapshotPresent,
        checksum: checksum || null,

        releaseState:
          safeStr(snapshot.releaseState) ||
          safeStr(responses.releaseState) ||
          null,

        sealedAt:
          snapshot?.governanceSeal?.sealedAt ||
          seal?.sealedAt ||
          snapshot?.releasedAt ||
          null,

        reviewerIntelligence: {
          executiveSummary: snapshot.executiveSummarySnapshot ?? null,
          finalRecommendation: snapshot.finalRecommendationSnapshot ?? null,
          autoRiskScore: snapshot.autoRiskScoreSnapshot ?? null,
          findings: safeArray(snapshot.findingsSnapshot),
          remediationHistory: safeArray(snapshot.remediationHistorySnapshot),
          remediationItems: safeArray(snapshot.remediationItemsSnapshot),
          attestationRequests: safeArray(snapshot.attestationRequestsSnapshot),
          reviewerConditions: safeArray(snapshot.reviewerConditionsSnapshot),
          governanceTimeline: safeArray(snapshot.governanceTimelineSnapshot),
          followUps: safeArray(snapshot.followUpsSnapshot),
          governanceDecision: snapshot.governanceDecisionSnapshot ?? null,
          federalInvestigationFollowUp: snapshot.federalInvestigationFollowUp ?? null,
          breachDisclosureFollowUp: snapshot.breachDisclosureFollowUp ?? null,
        },

        verificationModel: "TRV-BUNDLE-VERIFY-1.0",
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        verified: false,
        error:
          safeStr(error?.message) ||
          "Failed to verify governance bundle.",
      },
      { status: 500 },
    );
  }
}

