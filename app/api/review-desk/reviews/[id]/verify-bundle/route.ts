import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";
import { findLatestReviewResponse } from "@/lib/repositories/review-response-repository";
import { findReviewAssignment } from "@/lib/repositories/review-assignment-repository";
import { findVendor } from "@/lib/repositories/vendor-repository";

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

    const assignment = await findReviewAssignment({
      where: { id: assignmentId },
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
          where: { id: assignment.vendorId },
          select: { name: true },
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

