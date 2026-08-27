import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireReviewerAccess, requireFrameworkAssessmentAccess } from "@/lib/auth/truvern-governance";
import { updateTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { countTruvernRemediationRequests } from "@/lib/repositories/truvern-remediation-request-repository";
import { countTruvernAssessmentAttestations } from "@/lib/repositories/truvern-assessment-attestation-repository";
import { updateTruvernAssessmentFinding } from "@/lib/repositories/truvern-assessment-finding-repository";
import { findFirstTruvernRemediationRequest } from "@/lib/repositories/truvern-remediation-request-repository";
import { updateTruvernRemediationRequest } from "@/lib/repositories/truvern-remediation-request-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string; remediationId: string }>;
};

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: rawId, remediationId: rawRemediationId } = await context.params;
    const assessmentId = parseId(rawId);
    const remediationId = parseId(rawRemediationId);

    if (!assessmentId || !remediationId) {
      return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
    }

    await requireReviewerAccess();
    await requireFrameworkAssessmentAccess(assessmentId);

    const body = await request.json().catch(() => ({}));
    const decision = String(body.decision ?? "").trim().toLowerCase();
    const reviewerDecision =
      typeof body.reviewerDecision === "string" ? body.reviewerDecision.trim() : null;

    if (!["accept", "reject", "waive"].includes(decision)) {
      return NextResponse.json(
        { ok: false, error: "decision must be accept, reject, or waive." },
        { status: 400 },
      );
    }

    const existing = await findFirstTruvernRemediationRequest({
      where: {
        id: remediationId,
        finding: { assessmentId },
      },
      include: {
        finding: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Remediation request not found." }, { status: 404 });
    }

    const remediationStatus =
      decision === "accept" ? "ACCEPTED" : decision === "waive" ? "WAIVED" : "REJECTED";

    const findingStatus =
      decision === "accept" ? "REMEDIATED" : decision === "waive" ? "ACCEPTED_RISK" : "REMEDIATION_REQUESTED";

    const result = await prisma.$transaction(async (tx) => {
      const remediation = await updateTruvernRemediationRequest({
        where: { id: remediationId },
        data: {
          status: remediationStatus,
          reviewerDecision,
          resolvedAt: decision === "reject" ? null : new Date(),
        },
      }, tx);

      const finding = await updateTruvernAssessmentFinding({
        where: { id: existing.findingId },
        data: {
          status: findingStatus,
        },
      }, tx);

      /*
       * Release readiness must be based on the actual durable
       * vendor-work queues, not only finding status projection.
       *
       * This mirrors the attestation reviewer route and prevents
       * READY_FOR_RELEASE while any attestation or remediation
       * request remains unresolved.
       */
      const unresolvedAttestations =
        await countTruvernAssessmentAttestations({
          where: {
            assessmentId,
            status: {
              in: [
                "REQUESTED",
                "SUBMITTED",
                "REJECTED",
              ],
            },
          },
        }, tx);

      const unresolvedRemediation =
        await countTruvernRemediationRequests({
          where: {
            finding: {
              assessmentId,
            },
            status: {
              in: [
                "REQUESTED",
                "IN_PROGRESS",
                "SUBMITTED",
                "REJECTED",
              ],
            },
          },
        }, tx);

      const readyForRelease =
        unresolvedAttestations === 0 &&
        unresolvedRemediation === 0;

      await updateTruvernFrameworkAssessment({
        where: {
          id: assessmentId,
        },
        data: {
          status:
            readyForRelease
              ? "READY_FOR_RELEASE"
              : "IN_REVIEW",

          readyForReleaseAt:
            readyForRelease
              ? new Date()
              : null,
        },
      }, tx);

      return {
        remediation,
        finding,
        unresolvedAttestations,
        unresolvedRemediation,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to review remediation.",
      },
      { status: 500 },
    );
  }
}


