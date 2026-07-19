import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { writeGovernanceAuditLog } from "@/lib/governance/audit-log";
import { requireReviewerAccess, requireFrameworkAssessmentAccess } from "@/lib/auth/truvern-governance";
import { scoreAssessment, type TruvernScoringInput } from "@/lib/governance/scoring-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeResponses(responses: any[]): TruvernScoringInput[] {
  return responses.map((response) => ({
    questionId: response.questionId,
    controlId: response.question.control.id,
    controlCode: response.question.control.controlId,
    family: response.question.control.family,
    prompt: response.question.prompt,
    answer: response.answer,
    score: response.score,
    maxScore: response.question.weight ?? 1,
    weight: response.question.weight ?? 1,
    requiresEvidence: response.question.requiresEvidence,
    requiresAttestation: response.question.requiresAttestation,
    evidence: response.evidence,
  }));
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);

    if (!id) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    const assessment = await prisma.truvernFrameworkAssessment.findUnique({
      where: { id },
      include: {
        responses: {
          include: {
            question: {
              include: {
                control: true,
              },
            },
          },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json({ ok: false, error: "Assessment not found." }, { status: 404 });
    }

    const score = scoreAssessment(normalizeResponses(assessment.responses));

    const updated = await prisma.truvernFrameworkAssessment.update({
      where: { id },
      data: {
        score: score.score,
        maxScore: score.maxScore,
        riskLevel: score.riskLevel,
        status: assessment.status === "SUBMITTED" ? "IN_REVIEW" : assessment.status,
        metadata: {
          ...(assessment.metadata && typeof assessment.metadata === "object" ? assessment.metadata : {}),
          scoring: score,
          scoredAt: new Date().toISOString(),
        },
      },
    });

    await writeGovernanceAuditLog({
      organizationId: assessment.organizationId,
      entityType: "TruvernFrameworkAssessment",
      entityId: id,
      action: "FRAMEWORK_ASSESSMENT_SCORED",
      message: "Framework assessment was scored.",
      metadata: {
        score: score.score,
        maxScore: score.maxScore,
        percent: score.percent,
        riskLevel: score.riskLevel,
      },
    });

    return NextResponse.json({ ok: true, assessment: updated, score });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to score assessment." },
      { status: 500 },
    );
  }
}





