import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";
import { generateFindings } from "@/lib/governance/findings-engine";
import { normalizeFrameworkAssessmentFindingsInput } from "@/lib/governance/framework-assessment-findings-input";

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

const SUBMIT_AUDIT_ACTION =
  "FRAMEWORK_ASSESSMENT_SUBMITTED";

const FINDINGS_AUDIT_ACTION =
  "FRAMEWORK_FINDINGS_GENERATED";

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
              questionId: true,
              answer: true,
              score: true,
              evidence: true,
              question: {
                select: {
                  id: true,
                  prompt: true,
                  weight: true,
                  requiresEvidence: true,
                  requiresAttestation: true,
                  metadata: true,
                  control: {
                    select: {
                      id: true,
                      controlId: true,
                      family: true,
                    },
                  },
                },
              },
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
            "R18.6AC.PRE-FINDINGS",
          state:
            "R18_CANARY_PRE_FINDINGS_NOT_FOUND",
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
          entityType: true,
          entityId: true,
          action: true,
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

    const findingsAudits =
      await prisma.auditLog.findMany({
        where: {
          entityType:
            "TruvernFrameworkAssessment",
          entityId:
            String(assessment.id),
          action:
            FINDINGS_AUDIT_ACTION,
        },
        select: {
          id: true,
          entityType: true,
          entityId: true,
          action: true,
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

    const latestScoreAudit =
      scoreAudits[0] ?? null;

    const scoreAuditCertified =
      scoreAudits.length === 1 &&
      latestScoreAudit !== null &&
      latestScoreAudit.entityType ===
        "TruvernFrameworkAssessment" &&
      latestScoreAudit.entityId ===
        String(assessment.id) &&
      latestScoreAudit.action ===
        SCORE_AUDIT_ACTION;

    const latestSubmitAudit =
      submitAudits[0] ?? null;

    const submitAuditCertified =
      submitAudits.length === 1 &&
      latestSubmitAudit !== null &&
      latestSubmitAudit.entityType ===
        "TruvernFrameworkAssessment" &&
      latestSubmitAudit.entityId ===
        String(assessment.id) &&
      latestSubmitAudit.action ===
        SUBMIT_AUDIT_ACTION;

    const findingsAuditCertified =
      findingsAudits.length === 0;

    const normalizedInput =
      normalizeFrameworkAssessmentFindingsInput(
        assessment.responses,
      );

    const prediction =
      generateFindings(
        normalizedInput,
      );

    const predictionCertified =
      prediction.score.score ===
        EXPECTED_RESPONSE_COUNT &&
      prediction.score.maxScore ===
        EXPECTED_RESPONSE_COUNT &&
      prediction.score.riskLevel ===
        "LOW" &&
      prediction.findings.length === 0 &&
      prediction.remediationRequired ===
        false &&
      prediction.attestationRequired ===
        false;

    const certified =
      identityCertified &&
      isolationCertified &&
      lifecycleCertified &&
      scoringCertified &&
      responsesCertified &&
      downstreamCertified &&
      scoreAuditCertified &&
      submitAuditCertified &&
      findingsAuditCertified &&
      predictionCertified;

    return NextResponse.json(
      {
        ok: certified,

        certification:
          "R18.6AC.PRE-FINDINGS",

        state:
          certified
            ? "R18_CANARY_PRE_FINDINGS_CERTIFIED"
            : "R18_CANARY_PRE_FINDINGS_NOT_CERTIFIED",

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
          normalizedInputCount:
            normalizedInput.length,
        },

        downstream: {
          findingCount:
            assessment.findings.length,
          remediationCount,
          attestationCount:
            assessment.attestations.length,
        },

        audits: {
          score: {
            action:
              SCORE_AUDIT_ACTION,
            count:
              scoreAudits.length,
            certified:
              scoreAuditCertified,
            latest:
              latestScoreAudit,
          },

          submission: {
            action:
              SUBMIT_AUDIT_ACTION,
            count:
              submitAudits.length,
            certified:
              submitAuditCertified,
            latest:
              latestSubmitAudit,
          },

          findings: {
            action:
              FINDINGS_AUDIT_ACTION,
            count:
              findingsAudits.length,
            certified:
              findingsAuditCertified,
          },
        },

        prediction: {
          score:
            prediction.score.score,
          maxScore:
            prediction.score.maxScore,
          riskLevel:
            prediction.score.riskLevel,
          findingCount:
            prediction.findings.length,
          remediationRequired:
            prediction.remediationRequired,
          attestationRequired:
            prediction.attestationRequired,
          certified:
            predictionCertified,
        },

        checks: {
          identityCertified,
          isolationCertified,
          lifecycleCertified,
          scoringCertified,
          responsesCertified,
          downstreamCertified,
          scoreAuditCertified,
          submitAuditCertified,
          findingsAuditCertified,
          predictionCertified,
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
          "R18.6AC.PRE-FINDINGS",

        state:
          "R18_CANARY_PRE_FINDINGS_CERTIFICATION_FAILED",

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
