import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getEvidenceManifestForReview } from "@/lib/evidence/queries";
import { requireDbOrganization } from "@/lib/org-db";
import {
  canonicalizeGovernancePayload,
  signGovernancePayload,
} from "@/lib/governance/signing";
import { findLatestReviewResponse } from "@/lib/repositories/review-response-repository";
import { createGovernanceNotarizationReceipt } from "@/lib/governance/notarization";
import { findReviewAssignment } from "@/lib/repositories/review-assignment-repository";

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

    const assignment = await findReviewAssignment({
      where: { id: assignmentId },
      select: {
        id: true,
        reviewRequest: {
          select: {
            vendor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const latestResponse = assignment
      ? await findLatestReviewResponse(assignmentId)
      : null;

    const row = assignment
      ? {
          assignmentId: assignment.id,
          responseId: latestResponse?.id ?? null,
          responses: latestResponse?.responses ?? {},
          vendorId: assignment.reviewRequest?.vendor?.id ?? null,
          vendorName: assignment.reviewRequest?.vendor?.name ?? null,
        }
      : null;

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Review assignment not found." },
        { status: 404 },
      );
    }

    type GovernanceResponsesView = Record<string, any>;

    const rawResponses = row.responses && typeof row.responses === "object"
        ? row.responses
        : {};

    const responses: GovernanceResponsesView =
      rawResponses &&
      typeof rawResponses === "object" &&
      !Array.isArray(rawResponses)
        ? (rawResponses as GovernanceResponsesView)
        : {};

    const snapshot =
      responses?.governanceReleaseSnapshot &&
      typeof responses.governanceReleaseSnapshot === "object"
        ? responses.governanceReleaseSnapshot
        : null;

    const seal =
      snapshot?.governanceSeal && typeof snapshot.governanceSeal === "object"
        ? snapshot.governanceSeal
        : responses?.governanceSeal || {};

    const evidenceManifest =
      snapshot?.immutableEvidenceSnapshot?.manifest ||
      (await getEvidenceManifestForReview(assignmentId));

    const origin = new URL(req.url).origin;
    const basePath = `/review-desk/reviews/${assignmentId}`;

    const payload = {
      ok: true,
      manifestVersion: "TRV-GOV-MANIFEST-1.0",
      artifactType: "truvern_governance_release_manifest",

      assignmentId,
      responseId: row.responseId,

      vendorId: snapshot?.vendorId ?? row.vendorId ?? null,
      vendorName: snapshot?.vendorName ?? row.vendorName ?? null,

      releaseState:
        safeStr(snapshot?.releaseState) ||
        safeStr(responses.releaseState) ||
        null,

      reviewerIntelligence: {
        executiveSummary:
          snapshot?.executiveSummarySnapshot || null,

        finalRecommendation:
          snapshot?.finalRecommendationSnapshot || null,

        autoRiskScore:
          snapshot?.autoRiskScoreSnapshot || null,

        findings:
          Array.isArray(snapshot?.findingsSnapshot)
            ? snapshot.findingsSnapshot
            : [],

        remediationHistory:
          Array.isArray(snapshot?.remediationHistorySnapshot)
            ? snapshot.remediationHistorySnapshot
            : [],

        remediationItems:
          Array.isArray(snapshot?.remediationItemsSnapshot)
            ? snapshot.remediationItemsSnapshot
            : [],

        attestationRequests:
          Array.isArray(snapshot?.attestationRequestsSnapshot)
            ? snapshot.attestationRequestsSnapshot
            : [],

        reviewerConditions:
          Array.isArray(snapshot?.reviewerConditionsSnapshot)
            ? snapshot.reviewerConditionsSnapshot
            : [],

        governanceTimeline:
          Array.isArray(snapshot?.governanceTimelineSnapshot)
            ? snapshot.governanceTimelineSnapshot
            : [],

        followUps:
          Array.isArray(snapshot?.followUpsSnapshot)
            ? snapshot.followUpsSnapshot
            : [],

        governanceDecision:
          snapshot?.governanceDecisionSnapshot || null,

        federalInvestigationFollowUp:
          snapshot?.federalInvestigationFollowUp || null,

        breachDisclosureFollowUp:
          snapshot?.breachDisclosureFollowUp || null,
      },

      sealedAt:
        snapshot?.governanceSeal?.sealedAt ||
        seal?.sealedAt ||
        snapshot?.releasedAt ||
        null,

      checksum: safeStr(seal?.checksum) || null,
      checksumAlgorithm: safeStr(seal?.algorithm) || "SHA-256",
      sealVersion: safeStr(seal?.version) || "TRV-GOV-SEAL-1.0",

      verification: {
        verified: null,
        verificationUrl: `${origin}/api/review-desk/reviews/${assignmentId}/verify-seal`,
      },

      artifacts: {
        htmlPacketUrl: `${origin}${basePath}/packet`,
        pdfPacketUrl: `${origin}${basePath}/packet/pdf`,
        inlinePdfPacketUrl: `${origin}${basePath}/packet/pdf?inline=1`,
        releaseManifestUrl: `${origin}/api/review-desk/reviews/${assignmentId}/release-manifest`,
      },

      evidenceManifest,
      evidenceSummary: snapshot?.evidenceSummary || {
        artifactCount: 0,
      },

      snapshot: snapshot
        ? {
            exists: true,
            releasedAt: snapshot.releasedAt || null,
            decision: snapshot.decision || null,
            riskLevel: snapshot.riskLevel || null,
            normalizedAssessmentPresent: !!snapshot.normalizedAssessment,

            reviewerIntelligence: {
              executiveSummary:
                snapshot.executiveSummarySnapshot || null,

              finalRecommendation:
                snapshot.finalRecommendationSnapshot || null,

              autoRiskScore:
                snapshot.autoRiskScoreSnapshot || null,

              findings:
                Array.isArray(snapshot.findingsSnapshot)
                  ? snapshot.findingsSnapshot
                  : [],

              remediationHistory:
                Array.isArray(snapshot.remediationHistorySnapshot)
                  ? snapshot.remediationHistorySnapshot
                  : [],

              remediationItems:
                Array.isArray(snapshot.remediationItemsSnapshot)
                  ? snapshot.remediationItemsSnapshot
                  : [],

              attestationRequests:
                Array.isArray(snapshot.attestationRequestsSnapshot)
                  ? snapshot.attestationRequestsSnapshot
                  : [],

              reviewerConditions:
                Array.isArray(snapshot.reviewerConditionsSnapshot)
                  ? snapshot.reviewerConditionsSnapshot
                  : [],

              governanceTimeline:
                Array.isArray(snapshot.governanceTimelineSnapshot)
                  ? snapshot.governanceTimelineSnapshot
                  : [],

              followUps:
                Array.isArray(snapshot.followUpsSnapshot)
                  ? snapshot.followUpsSnapshot
                  : [],

              governanceDecision:
                snapshot.governanceDecisionSnapshot || null,

              federalInvestigationFollowUp:
                snapshot.federalInvestigationFollowUp || null,

              breachDisclosureFollowUp:
                snapshot.breachDisclosureFollowUp || null,
            },
          }
        : {
            exists: false,
          },
    };

    const signature = signGovernancePayload(payload);
    const notarizationReceipt = createGovernanceNotarizationReceipt({
  checksum: safeStr(seal?.checksum) || "",
  signature: signature.signature,
  timestamp:
    snapshot?.governanceSeal?.sealedAt ||
    seal?.sealedAt ||
    snapshot?.releasedAt ||
    new Date().toISOString(),
});

    return NextResponse.json(
      {
        ...payload,
        signature,
        notarizationReceipt,
        canonicalPayload: canonicalizeGovernancePayload(payload),
      },
      {
        headers: {
          "cache-control": "no-store",
          "content-disposition": `attachment; filename="truvern-release-manifest-${assignmentId}.json"`,
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          safeStr(error?.message) ||
          "Failed to generate governance release manifest.",
      },
      { status: 500 },
    );
  }
}







