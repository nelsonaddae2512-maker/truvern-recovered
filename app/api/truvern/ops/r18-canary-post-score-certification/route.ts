import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CANARY_TITLE =
  "TRUVERN R18 GOVERNANCE RELEASE CANARY — DO NOT USE";

const FRAMEWORK_SLUG =
  "nist-800-53-rev5";

const FRAMEWORK_VERSION =
  "5.2.0";

const SCORE_AUDIT_ACTION =
  "FRAMEWORK_ASSESSMENT_SCORED";

const EXPECTED_RESPONSE_COUNT = 301;

export async function GET() {
  await requireOpsAccess();

  try {
    const assessment =
      await prisma.truvernFrameworkAssessment.findFirst({
        where: {
          title: CANARY_TITLE,
          organizationId: null,
          vendorId: null,
          assessmentRunId: null,
          reviewAssignmentId: null,
          releasedAt: null,
          status: "IN_REVIEW",
          framework: {
            is: {
              slug: FRAMEWORK_SLUG,
              version: FRAMEWORK_VERSION,
            },
          },
        },
        orderBy: [
          {
            id: "desc",
          },
        ],
        select: {
          id: true,
          title: true,
          status: true,

          organizationId: true,
          vendorId: true,
          assessmentRunId: true,
          reviewAssignmentId: true,

          sentAt: true,
          submittedAt: true,
          readyForReleaseAt: true,
          releasedAt: true,

          score: true,
          maxScore: true,
          riskLevel: true,

          metadata: true,

          framework: {
            select: {
              id: true,
              slug: true,
              name: true,
              version: true,
            },
          },

          responses: {
            select: {
              id: true,
              answer: true,
              score: true,
            },
          },

          findings: {
            select: {
              id: true,
            },
          },

          attestations: {
            select: {
              id: true,
            },
          },
        },
      });

    if (!assessment) {
      return NextResponse.json(
        {
          ok: false,
          certification:
            "R18.6AC.POST-SCORE",
          state:
            "R18_CANARY_POST_SCORE_NOT_FOUND",
          mutations: {
            assessmentUpdated: false,
            responsesUpdated: false,
            auditWritten: false,
            scored: false,
            findingsGenerated: false,
            releaseInvoked: false,
            signingInvoked: false,
            writePerformed: false,
          },
        },
        {
          status: 404,
        },
      );
    }

    const remediationCount =
      await prisma.truvernRemediationRequest.count({
        where: {
          finding: {
            assessmentId:
              assessment.id,
          },
        },
      });

    const scoreAudits =
      await prisma.auditLog.findMany({
        where: {
          entityType:
            "TruvernFrameworkAssessment",
          entityId:
            String(assessment.id),
          action:
            SCORE_AUDIT_ACTION,
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
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        take: 10,
      });

    const latestScoreAudit =
      scoreAudits[0] ?? null;

    const responseCount =
      assessment.responses.length;

    const answeredCount =
      assessment.responses.filter(
        (response) => {
          const answer =
            response.answer;

          if (
            answer === null ||
            answer === undefined
          ) {
            return false;
          }

          if (
            typeof answer === "string"
          ) {
            return (
              answer.trim().length > 0
            );
          }

          return true;
        },
      ).length;

    const unansweredCount =
      responseCount - answeredCount;

    const nonNullScoreCount =
      assessment.responses.filter(
        (response) =>
          response.score !== null,
      ).length;

    const identityCertified =
      assessment.title === CANARY_TITLE &&
      assessment.framework.slug ===
        FRAMEWORK_SLUG &&
      assessment.framework.version ===
        FRAMEWORK_VERSION;

    const isolationCertified =
      assessment.organizationId === null &&
      assessment.vendorId === null &&
      assessment.assessmentRunId === null &&
      assessment.reviewAssignmentId === null;

    const lifecycleCertified =
      assessment.status === "IN_REVIEW" &&
      assessment.submittedAt !== null &&
      assessment.readyForReleaseAt === null &&
      assessment.releasedAt === null;

    const scoringCertified =
      assessment.score ===
        EXPECTED_RESPONSE_COUNT &&
      assessment.maxScore ===
        EXPECTED_RESPONSE_COUNT &&
      assessment.riskLevel === "LOW";

    const responsesCertified =
      responseCount ===
        EXPECTED_RESPONSE_COUNT &&
      answeredCount ===
        EXPECTED_RESPONSE_COUNT &&
      unansweredCount === 0;

    const downstreamCertified =
      assessment.findings.length === 0 &&
      remediationCount === 0 &&
      assessment.attestations.length === 0;

    const auditCertified =
      scoreAudits.length === 1 &&
      latestScoreAudit !== null &&
      latestScoreAudit.entityType ===
        "TruvernFrameworkAssessment" &&
      latestScoreAudit.entityId ===
        String(assessment.id) &&
      latestScoreAudit.action ===
        SCORE_AUDIT_ACTION;

    const certified =
      identityCertified &&
      isolationCertified &&
      lifecycleCertified &&
      scoringCertified &&
      responsesCertified &&
      downstreamCertified &&
      auditCertified;

    return NextResponse.json(
      {
        ok: certified,

        certification:
          "R18.6AC.POST-SCORE",

        state:
          certified
            ? "R18_CANARY_POST_SCORE_CERTIFIED"
            : "R18_CANARY_POST_SCORE_NOT_CERTIFIED",

        canary: {
          id:
            assessment.id,
          title:
            assessment.title,
          status:
            assessment.status,

          organizationId:
            assessment.organizationId,
          vendorId:
            assessment.vendorId,
          assessmentRunId:
            assessment.assessmentRunId,
          reviewAssignmentId:
            assessment.reviewAssignmentId,

          sentAt:
            assessment.sentAt,
          submittedAt:
            assessment.submittedAt,
          readyForReleaseAt:
            assessment.readyForReleaseAt,
          releasedAt:
            assessment.releasedAt,

          score:
            assessment.score,
          maxScore:
            assessment.maxScore,
          riskLevel:
            assessment.riskLevel,

          framework:
            assessment.framework,
        },

        responses: {
          expected:
            EXPECTED_RESPONSE_COUNT,
          responseCount,
          answeredCount,
          unansweredCount,
          nonNullScoreCount,
        },

        downstream: {
          findingCount:
            assessment.findings.length,
          remediationCount,
          attestationCount:
            assessment.attestations.length,
        },

        scoreAudit: {
          action:
            SCORE_AUDIT_ACTION,
          count:
            scoreAudits.length,
          found:
            latestScoreAudit !== null,
          latest:
            latestScoreAudit,
        },

        metadata: {
          present:
            assessment.metadata !== null,
          value:
            assessment.metadata,
        },

        checks: {
          identityCertified,
          isolationCertified,
          lifecycleCertified,
          scoringCertified,
          responsesCertified,
          downstreamCertified,
          auditCertified,
        },

        mutations: {
          assessmentUpdated: false,
          responsesUpdated: false,
          auditWritten: false,
          scored: false,
          findingsGenerated: false,
          releaseInvoked: false,
          signingInvoked: false,
          writePerformed: false,
        },
      },
      {
        status:
          certified
            ? 200
            : 409,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        certification:
          "R18.6AC.POST-SCORE",

        state:
          "R18_CANARY_POST_SCORE_CERTIFICATION_FAILED",

        error:
          error instanceof Error
            ? error.message
            : String(error),

        mutations: {
          assessmentUpdated: false,
          responsesUpdated: false,
          auditWritten: false,
          scored: false,
          findingsGenerated: false,
          releaseInvoked: false,
          signingInvoked: false,
          writePerformed: false,
        },
      },
      {
        status: 500,
      },
    );
  }
}
