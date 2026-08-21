import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireReviewerAccess, requireFrameworkAssessmentAccess } from "@/lib/auth/truvern-governance";
import { updateTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { countTruvernAssessmentFindings } from "@/lib/repositories/truvern-assessment-finding-repository";
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

      const unresolvedRequired = await countTruvernAssessmentFindings({
        where: {
          assessmentId,
          OR: [
            {
              remediationRequired: true,
              status: { in: ["OPEN", "REMEDIATION_REQUESTED"] },
            },
            {
              attestationRequired: true,
              status: { in: ["OPEN", "REMEDIATION_REQUESTED"] },
            },
          ],
        },
      }, tx);

      await updateTruvernFrameworkAssessment({
        where: { id: assessmentId },
        data: {
          status: unresolvedRequired === 0 ? "READY_FOR_RELEASE" : "IN_REVIEW",
          readyForReleaseAt: unresolvedRequired === 0 ? new Date() : null,
        },
      }, tx);

      return { remediation, finding, unresolvedRequired };
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



