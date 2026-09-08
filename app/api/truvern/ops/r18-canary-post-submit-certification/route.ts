import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CANARY_TITLE =
  "TRUVERN R18 GOVERNANCE RELEASE CANARY — DO NOT USE";

const FRAMEWORK_SLUG =
  "nist-800-53-rev5";

const FRAMEWORK_VERSION =
  "5.2.0";

const SUBMIT_AUDIT_ACTION =
  "FRAMEWORK_ASSESSMENT_SUBMITTED";

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
          status: "SUBMITTED",
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
            "R18.6AC.POST-SUBMIT",
          state:
            "R18_CANARY_POST_SUBMIT_NOT_FOUND",
          mutations: {
            assessmentUpdated: false,
            responsesUpdated: false,
            auditWritten: false,
            scored: false,
            findingsGenerated: false,
            releaseInvoked: false,
            signingInvoked: false,
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

    const submitAudits =
      await prisma.auditLog.findMany({
        where: {
          entityType:
            "TruvernFrameworkAssessment",
          entityId:
            String(assessment.id),
          action:
            SUBMIT_AUDIT_ACTION,
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
        take: 10,
      });

    const latestSubmitAudit =
      submitAudits[0] ?? null;

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
      assessment.status === "SUBMITTED" &&
      assessment.submittedAt !== null &&
      assessment.readyForReleaseAt === null &&
      assessment.releasedAt === null;

    const responsesCertified =
      responseCount === 301 &&
      answeredCount === 301 &&
      unansweredCount === 0 &&
      nonNullScoreCount === 0;

    const downstreamCertified =
      assessment.findings.length === 0 &&
      remediationCount === 0 &&
      assessment.attestations.length === 0 &&
      assessment.score === null &&
      assessment.maxScore === null &&
      assessment.riskLevel === null;

    const auditCertified =
      submitAudits.length >= 1 &&
      latestSubmitAudit !== null &&
      latestSubmitAudit.entityType ===
        "TruvernFrameworkAssessment" &&
      latestSubmitAudit.entityId ===
        String(assessment.id) &&
      latestSubmitAudit.action ===
        SUBMIT_AUDIT_ACTION;

    const certified =
      identityCertified &&
      isolationCertified &&
      lifecycleCertified &&
      responsesCertified &&
      downstreamCertified &&
      auditCertified;

    return NextResponse.json(
      {
        ok: certified,

        certification:
          "R18.6AC.POST-SUBMIT",

        state:
          certified
            ? "R18_CANARY_POST_SUBMIT_CERTIFIED"
            : "R18_CANARY_POST_SUBMIT_NOT_CERTIFIED",

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

        submitAudit: {
          count:
            submitAudits.length,
          found:
            latestSubmitAudit !== null,
          latest:
            latestSubmitAudit,
        },

        checks: {
          identityCertified,
          isolationCertified,
          lifecycleCertified,
          responsesCertified,
          downstreamCertified,
          auditCertified,
        },

        mutations: {
          assessmentUpdated:
            false,
          responsesUpdated:
            false,
          auditWritten:
            false,
          scored:
            false,
          findingsGenerated:
            false,
          releaseInvoked:
            false,
          signingInvoked:
            false,
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
          "R18.6AC.POST-SUBMIT",

        state:
          "R18_CANARY_POST_SUBMIT_CERTIFICATION_FAILED",

        error:
          error instanceof Error
            ? error.message
            : String(error),

        mutations: {
          assessmentUpdated:
            false,
          responsesUpdated:
            false,
          auditWritten:
            false,
          scored:
            false,
          findingsGenerated:
            false,
          releaseInvoked:
            false,
          signingInvoked:
            false,
        },
      },
      {
        status: 500,
      },
    );
  }
}
