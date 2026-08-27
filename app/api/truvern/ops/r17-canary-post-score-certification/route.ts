import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CANARY_ID = 1;

const EXPECTED_TITLE =
  "TRUVERN R17 GOVERNANCE RELEASE CANARY — DO NOT USE";

export async function GET() {
  try {
    await requireOpsAccess();

    const assessment =
      await prisma.truvernFrameworkAssessment.findUnique({
        where: {
          id: CANARY_ID,
        },
        select: {
          id: true,
          title: true,
          organizationId: true,
          vendorId: true,
          assessmentRunId: true,
          reviewAssignmentId: true,
          status: true,
          score: true,
          maxScore: true,
          riskLevel: true,
          submittedAt: true,
          readyForReleaseAt: true,
          releasedAt: true,
          metadata: true,
          _count: {
            select: {
              responses: true,
              findings: true,
              attestations: true,
            },
          },
        },
      });

    if (!assessment) {
      return NextResponse.json(
        {
          ok: false,
          state: "CANARY_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }

    if (
      assessment.title !== EXPECTED_TITLE ||
      assessment.organizationId !== null ||
      assessment.vendorId !== null
    ) {
      return NextResponse.json(
        {
          ok: false,
          state: "CANARY_IDENTITY_NOT_CERTIFIED",
          assessment,
        },
        {
          status: 409,
        }
      );
    }

    const responses =
      await prisma.truvernAssessmentResponse.findMany({
        where: {
          assessmentId: CANARY_ID,
        },
        select: {
          answer: true,
          score: true,
        },
      });

    const answeredCount =
      responses.filter((response) => {
        const answer = response.answer;

        return (
          typeof answer === "string" &&
          answer.trim().length > 0
        );
      }).length;

    const persistedResponseScoreCount =
      responses.filter(
        (response) => response.score !== null
      ).length;

    const remediationCount =
      await prisma.truvernRemediationRequest.count({
        where: {
          finding: {
            assessmentId: CANARY_ID,
          },
        },
      });

    const scoreAudits =
      await prisma.auditLog.findMany({
        where: {
          entityType: "TruvernFrameworkAssessment",
          entityId: String(CANARY_ID),
          action: "FRAMEWORK_ASSESSMENT_SCORED",
        },
        select: {
          id: true,
          organizationId: true,
          actorUserId: true,
          entityType: true,
          entityId: true,
          action: true,
          message: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    const scoringMetadata =
      assessment.metadata &&
      typeof assessment.metadata === "object" &&
      !Array.isArray(assessment.metadata)
        ? assessment.metadata
        : null;

    const assessmentCertified =
      assessment.status === "IN_REVIEW" &&
      assessment.score === 301 &&
      assessment.maxScore === 301 &&
      assessment.riskLevel === "LOW" &&
      assessment.submittedAt !== null &&
      assessment.readyForReleaseAt === null &&
      assessment.releasedAt === null;

    const responseCertified =
      assessment._count.responses === 301 &&
      responses.length === 301 &&
      answeredCount === 301;

    const downstreamPristine =
      assessment._count.findings === 0 &&
      remediationCount === 0 &&
      assessment._count.attestations === 0;

    const auditCertified =
      scoreAudits.length >= 1;

    const certified =
      assessmentCertified &&
      responseCertified &&
      downstreamPristine &&
      auditCertified;

    return NextResponse.json(
      {
        ok: certified,
        certification:
          "R46G.7G-E7-M.2F-R17.20",
        state: certified
          ? "CANARY_POST_SCORE_CERTIFIED"
          : "CANARY_POST_SCORE_NOT_CERTIFIED",

        canary: {
          id: assessment.id,
          title: assessment.title,
          organizationId:
            assessment.organizationId,
          vendorId:
            assessment.vendorId,
          assessmentRunId:
            assessment.assessmentRunId,
          reviewAssignmentId:
            assessment.reviewAssignmentId,
          status:
            assessment.status,
          score:
            assessment.score,
          maxScore:
            assessment.maxScore,
          riskLevel:
            assessment.riskLevel,
          submittedAt:
            assessment.submittedAt,
          readyForReleaseAt:
            assessment.readyForReleaseAt,
          releasedAt:
            assessment.releasedAt,
        },

        responses: {
          expected: 301,
          persisted:
            assessment._count.responses,
          loaded:
            responses.length,
          answered:
            answeredCount,
          persistedResponseScores:
            persistedResponseScoreCount,
        },

        downstream: {
          findings:
            assessment._count.findings,
          remediation:
            remediationCount,
          attestations:
            assessment._count.attestations,
          pristine:
            downstreamPristine,
        },

        audit: {
          action:
            "FRAMEWORK_ASSESSMENT_SCORED",
          count:
            scoreAudits.length,
          certified:
            auditCertified,
          latest:
            scoreAudits[0] ?? null,
        },

        metadata: {
          present:
            scoringMetadata !== null,
          value:
            scoringMetadata,
        },

        certificationChecks: {
          assessmentCertified,
          responseCertified,
          downstreamPristine,
          auditCertified,
        },

        mutations: {
          assessmentUpdated: false,
          responsesUpdated: false,
          auditWritten: false,
          findingsGenerated: false,
          releaseInvoked: false,
          signingInvoked: false,
          writePerformed: false,
        },
      },
      {
        status: certified ? 200 : 409,
      }
    );
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,
        state: "CANARY_POST_SCORE_CERTIFICATION_FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      {
        status: 500,
      }
    );
  }
}
