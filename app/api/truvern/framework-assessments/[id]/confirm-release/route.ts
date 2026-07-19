import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { writeGovernanceAuditLog } from "@/lib/governance/audit-log";
import { requireReviewerAccess, requireFrameworkAssessmentAccess } from "@/lib/auth/truvern-governance";
import {
  buildFrameworkReleaseSnapshot,
  checksumSnapshot,
} from "@/lib/governance/framework-release";

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
          { remediationRequired: true, status: { in: ["OPEN", "REMEDIATION_REQUESTED"] } },
          { attestationRequired: true, status: { in: ["OPEN", "REMEDIATION_REQUESTED"] } },
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
          error: "Assessment cannot be released until all remediation and attestations are resolved.",
          unresolved: {
            findings: unresolvedFindings,
            remediation: unresolvedRemediation,
            attestations: unresolvedAttestations,
          },
        },
        { status: 409 },
      );
    }

    const assessment = await prisma.truvernFrameworkAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        framework: true,
        responses: {
          include: {
            question: {
              include: {
                control: true,
              },
            },
          },
          orderBy: [{ questionId: "asc" }],
        },
        findings: {
          include: {
            remediations: {
              orderBy: [{ createdAt: "asc" }],
            },
          },
          orderBy: [{ createdAt: "asc" }],
        },
        attestations: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!assessment) {
      return NextResponse.json({ ok: false, error: "Assessment not found." }, { status: 404 });
    }

    const snapshot = buildFrameworkReleaseSnapshot(assessment);
    const checksum = checksumSnapshot(snapshot);
    const releasedAt = new Date();

    const updated = await prisma.truvernFrameworkAssessment.update({
      where: { id: assessmentId },
      data: {
        status: "RELEASED",
        releasedAt,
        readyForReleaseAt: assessment.readyForReleaseAt ?? releasedAt,
        metadata: {
          ...(assessment.metadata && typeof assessment.metadata === "object" ? assessment.metadata : {}),
          governanceReleaseSnapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
          governanceSeal: {
            algorithm: "sha256",
            checksum,
            schema: snapshot.schema,
            sealedAt: releasedAt.toISOString(),
            version: 1,
          },
        },
      },
    });

    await writeGovernanceAuditLog({
      organizationId: assessment.organizationId,
      entityType: "TruvernFrameworkAssessment",
      entityId: assessmentId,
      action: "FRAMEWORK_RELEASE_CONFIRMED",
      message: "Framework assessment immutable release was confirmed.",
      metadata: {
        checksum,
        sealedAt: releasedAt.toISOString(),
        schema: snapshot.schema,
      },
    });

    return NextResponse.json({
      ok: true,
      assessment: updated,
      seal: {
        algorithm: "sha256",
        checksum,
        schema: snapshot.schema,
        sealedAt: releasedAt.toISOString(),
        version: 1,
      },
      verifyUrl: `/api/truvern/framework-assessments/${assessmentId}/verify`,
      packetUrl: `/api/truvern/framework-assessments/${assessmentId}/packet`,
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to confirm framework assessment release.",
      },
      { status: 500 },
    );
  }
}







