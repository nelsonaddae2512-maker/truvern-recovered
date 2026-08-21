import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireReviewerAccess, requireFrameworkAssessmentAccess } from "@/lib/auth/truvern-governance";
import { updateTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { countTruvernRemediationRequests } from "@/lib/repositories/truvern-remediation-request-repository";
import { findFirstTruvernAssessmentAttestation } from "@/lib/repositories/truvern-assessment-attestation-repository";
import { countTruvernAssessmentAttestations } from "@/lib/repositories/truvern-assessment-attestation-repository";
import { updateTruvernAssessmentAttestation } from "@/lib/repositories/truvern-assessment-attestation-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string; attestationId: string }>;
};

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: rawId, attestationId: rawAttestationId } = await context.params;
    const assessmentId = parseId(rawId);
    const attestationId = parseId(rawAttestationId);

    if (!assessmentId || !attestationId) {
      return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const decision = String(body.decision ?? "").trim().toLowerCase();

    if (!["accept", "reject"].includes(decision)) {
      return NextResponse.json(
        { ok: false, error: "decision must be accept or reject." },
        { status: 400 },
      );
    }

    const existing = await findFirstTruvernAssessmentAttestation({
      where: {
        id: attestationId,
        assessmentId,
      },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Attestation request not found." }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const attestation = await updateTruvernAssessmentAttestation({
        where: { id: attestationId },
        data: {
          status: decision === "accept" ? "ACCEPTED" : "REJECTED",
          reviewedAt: new Date(),
          metadata: {
            ...(existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
            reviewerDecision: decision,
            reviewedAt: new Date().toISOString(),
          },
        },
      }, tx);

      const unresolvedAttestations = await countTruvernAssessmentAttestations({
        where: {
          assessmentId,
          status: { in: ["REQUESTED", "SUBMITTED", "REJECTED"] },
        },
      }, tx);

      const unresolvedRemediation = await countTruvernRemediationRequests({
        where: {
          finding: { assessmentId },
          status: { in: ["REQUESTED", "IN_PROGRESS", "SUBMITTED", "REJECTED"] },
        },
      }, tx);

      await updateTruvernFrameworkAssessment({
        where: { id: assessmentId },
        data: {
          status:
            unresolvedAttestations === 0 && unresolvedRemediation === 0
              ? "READY_FOR_RELEASE"
              : "IN_REVIEW",
          readyForReleaseAt:
            unresolvedAttestations === 0 && unresolvedRemediation === 0 ? new Date() : null,
        },
      }, tx);

      return { attestation, unresolvedAttestations, unresolvedRemediation };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to review attestation.",
      },
      { status: 500 },
    );
  }
}



