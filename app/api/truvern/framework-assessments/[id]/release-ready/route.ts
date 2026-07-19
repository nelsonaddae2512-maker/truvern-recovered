import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { writeGovernanceAuditLog } from "@/lib/governance/audit-log";
import { requireReviewerAccess, requireFrameworkAssessmentAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const assessmentId = parseId(rawId);

    if (!assessmentId) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    await requireReviewerAccess();
    await requireFrameworkAssessmentAccess(assessmentId);

    const unresolvedFindings = await prisma.truvernAssessmentFinding.count({
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
    });

    const unresolvedRemediation = await prisma.truvernRemediationRequest.count({
      where: {
        finding: { assessmentId },
        status: { in: ["REQUESTED", "IN_PROGRESS", "SUBMITTED", "REJECTED"] },
      },
    });

    const unresolvedAttestations = await prisma.truvernAssessmentAttestation.count({
      where: {
        assessmentId,
        status: { in: ["REQUESTED", "SUBMITTED", "REJECTED"] },
      },
    });

    if (unresolvedFindings || unresolvedRemediation || unresolvedAttestations) {
      return NextResponse.json(
        {
          ok: false,
          error: "Assessment still has unresolved remediation, findings, or attestations.",
          unresolved: {
            findings: unresolvedFindings,
            remediation: unresolvedRemediation,
            attestations: unresolvedAttestations,
          },
        },
        { status: 409 },
      );
    }

    const assessment = await prisma.truvernFrameworkAssessment.update({
      where: { id: assessmentId },
      data: {
        status: "READY_FOR_RELEASE",
        readyForReleaseAt: new Date(),
      },
    });

    await writeGovernanceAuditLog({
      organizationId: assessment.organizationId,
      entityType: "TruvernFrameworkAssessment",
      entityId: assessmentId,
      action: "FRAMEWORK_RELEASE_READY",
      message: "Framework assessment was marked release-ready.",
      metadata: {
        readyForReleaseAt: assessment.readyForReleaseAt,
      },
    });

    return NextResponse.json({ ok: true, assessment });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to mark assessment release-ready.",
      },
      { status: 500 },
    );
  }
}





