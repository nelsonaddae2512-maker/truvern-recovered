import { NextResponse } from "next/server";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CANARY_ID = 1;

const CANARY_TITLE =
  "TRUVERN R17 GOVERNANCE RELEASE CANARY — DO NOT USE";

const FRAMEWORK_SLUG =
  "nist-800-53-rev5";

const FRAMEWORK_VERSION =
  "5.2.0";

const SUBMIT_AUDIT_ACTION =
  "FRAMEWORK_ASSESSMENT_SUBMITTED";

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
          framework: {
            select: {
              id: true,
              slug: true,
              name: true,
              version: true,
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

    if (!assessment) {
      return NextResponse.json(
        {
          ok: false,
          certification:
            "R46G.7G-E7-M.2F-R17.14-R1",
          state: "CANARY_NOT_FOUND",
          canaryId: CANARY_ID,
          writePerformed: false,
        },
        {
          status: 404,
        }
      );
    }

    const identityCertified =
      assessment.id === CANARY_ID &&
      assessment.title === CANARY_TITLE &&
      assessment.organizationId === null &&
      assessment.vendorId === null &&
      assessment.assessmentRunId === null &&
      assessment.reviewAssignmentId === null &&
      assessment.framework.slug === FRAMEWORK_SLUG &&
      assessment.framework.version === FRAMEWORK_VERSION;

    if (!identityCertified) {
      return NextResponse.json(
        {
          ok: false,
          certification:
            "R46G.7G-E7-M.2F-R17.14-R1",
          state: "CANARY_IDENTITY_NOT_CERTIFIED",
          assessment,
          writePerformed: false,
        },
        {
          status: 409,
        }
      );
    }

    const responseCount =
      assessment._count.responses;

    const responseRows =
      await prisma.truvernAssessmentResponse.findMany({
        where: {
          assessmentId: CANARY_ID,
        },
        select: {
          id: true,
          answer: true,
          score: true,
        },
      });

    const answeredCount =
      responseRows.filter((response) => {
        const answer = response.answer;

        if (answer === null || answer === undefined) {
          return false;
        }

        if (typeof answer === "string") {
          return answer.trim().length > 0;
        }

        return true;
      }).length;

    const nonNullScoreCount =
      responseRows.filter(
        (response) =>
          response.score !== null,
      ).length;

    const remediationCount =
      await prisma.truvernRemediationRequest.count({
        where: {
          finding: {
            assessmentId: CANARY_ID,
          },
        },
      });

    const submitAudits =
      await prisma.auditLog.findMany({
        where: {
          entityType:
            "TruvernFrameworkAssessment",
          entityId:
            String(CANARY_ID),
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

    const lifecycleCertified =
      assessment.status === "SUBMITTED" &&
      assessment.submittedAt !== null &&
      assessment.readyForReleaseAt === null &&
      assessment.releasedAt === null;

    const responseContractCertified =
      responseCount === 301 &&
      answeredCount === 301;

    const downstreamPristine =
      nonNullScoreCount === 0 &&
      assessment.score === null &&
      assessment.maxScore === null &&
      assessment.riskLevel === null &&
      assessment._count.findings === 0 &&
      remediationCount === 0 &&
      assessment._count.attestations === 0;

    const auditCertified =
      submitAudits.length >= 1 &&
      latestSubmitAudit !== null &&
      latestSubmitAudit.entityType ===
        "TruvernFrameworkAssessment" &&
      latestSubmitAudit.entityId ===
        String(CANARY_ID) &&
      latestSubmitAudit.action ===
        SUBMIT_AUDIT_ACTION;

    const certified =
      identityCertified &&
      lifecycleCertified &&
      responseContractCertified &&
      downstreamPristine &&
      auditCertified;

    return NextResponse.json(
      {
        ok: certified,
        certification:
          "R46G.7G-E7-M.2F-R17.14-R1",
        state: certified
          ? "CANARY_POST_SUBMIT_CERTIFIED"
          : "CANARY_POST_SUBMIT_NOT_CERTIFIED",

        canary: {
          id: assessment.id,
          title: assessment.title,
          status: assessment.status,
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
          total:
            responseCount,
          answered:
            answeredCount,
          nonNullScores:
            nonNullScoreCount,
        },

        downstream: {
          findings:
            assessment._count.findings,
          remediation:
            remediationCount,
          attestations:
            assessment._count.attestations,
        },

        submitAudit: {
          count:
            submitAudits.length,
          found:
            latestSubmitAudit !== null,
          latest:
            latestSubmitAudit,
        },

        certificationChecks: {
          identityCertified,
          lifecycleCertified,
          responseContractCertified,
          downstreamPristine,
          auditCertified,
        },

        mutations: {
          assessmentUpdated: false,
          responsesUpdated: false,
          auditWritten: false,
          scoreInvoked: false,
          findingsGenerated: false,
          releaseInvoked: false,
          signingInvoked: false,
        },

        writePerformed: false,
      },
      {
        status: certified ? 200 : 409,
      }
    );
  } catch (error) {
    console.error(
      "R17.14-R1 certification failed:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        certification:
          "R46G.7G-E7-M.2F-R17.14-R1",
        state:
          "CANARY_POST_SUBMIT_CERTIFICATION_FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Unknown certification failure.",
        writePerformed: false,
      },
      {
        status: 500,
      }
    );
  }
}
