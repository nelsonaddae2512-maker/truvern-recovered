import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await requireReviewerAccess();
    const assessments = await prisma.truvernFrameworkAssessment.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 50,
      include: {
        framework: {
          select: {
            id: true,
            slug: true,
            name: true,
            version: true,
          },
        },
        findings: {
          select: {
            id: true,
            severity: true,
            status: true,
            remediationRequired: true,
            attestationRequired: true,
          },
        },
        attestations: {
          select: {
            id: true,
            status: true,
          },
        },
        _count: {
          select: {
            responses: true,
            findings: true,
            attestations: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      assessments: assessments.map((assessment) => ({
        id: assessment.id,
        title: assessment.title,
        status: assessment.status,
        score: assessment.score,
        maxScore: assessment.maxScore,
        riskLevel: assessment.riskLevel,
        vendorId: assessment.vendorId,
        organizationId: assessment.organizationId,
        assessmentRunId: assessment.assessmentRunId,
        reviewAssignmentId: assessment.reviewAssignmentId,
        submittedAt: assessment.submittedAt,
        readyForReleaseAt: assessment.readyForReleaseAt,
        releasedAt: assessment.releasedAt,
        updatedAt: assessment.updatedAt,
        framework: assessment.framework,
        counts: assessment._count,
        findingSummary: {
          critical: assessment.findings.filter((f) => f.severity === "CRITICAL").length,
          high: assessment.findings.filter((f) => f.severity === "HIGH").length,
          open: assessment.findings.filter((f) => f.status === "OPEN").length,
          remediationRequired: assessment.findings.filter((f) => f.remediationRequired).length,
          attestationRequired: assessment.findings.filter((f) => f.attestationRequired).length,
          attestationsOpen: assessment.attestations.filter((a) => a.status === "REQUESTED").length,
        },
      })),
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load framework assessments for Governance Ops.",
      },
      { status: 500 },
    );
  }
}




