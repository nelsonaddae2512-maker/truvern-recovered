import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";

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

export async function GET() {
  await requireOpsAccess();

  try {
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
              evidence: true,

              question: {
                select: {
                  requiresEvidence: true,
                  requiresAttestation: true,
                },
              },
            },
          },

          findings: {
            select: {
              id: true,
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
        },
      });

    if (!assessment) {
      return NextResponse.json(
        {
          ok: false,
          certification:
            "R46G.7G-E7-M.2F-R17.11",
          state:
            "CANARY_NOT_FOUND",
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
              CANARY_ID,
          },
        },
      });

    const responseCount =
      assessment.responses.length;

    const answeredCount =
      assessment.responses.filter(
        (response) =>
          typeof response.answer === "string" &&
          response.answer.trim().length > 0,
      ).length;

    const unansweredCount =
      responseCount - answeredCount;

    const nonNullScoreCount =
      assessment.responses.filter(
        (response) =>
          response.score !== null,
      ).length;

    const requiredEvidenceCount =
      assessment.responses.filter(
        (response) =>
          response.question.requiresEvidence,
      ).length;

    const requiredAttestationCount =
      assessment.responses.filter(
        (response) =>
          response.question.requiresAttestation,
      ).length;

    const missingRequiredEvidence =
      assessment.responses.filter(
        (response) =>
          response.question.requiresEvidence &&
          (
            response.evidence === null ||
            response.evidence === undefined
          ),
      ).length;

    const identityCertified =
      assessment.id === CANARY_ID &&
      assessment.title === CANARY_TITLE &&
      assessment.framework.slug === FRAMEWORK_SLUG &&
      assessment.framework.version === FRAMEWORK_VERSION;

    const isolationCertified =
      assessment.organizationId === null &&
      assessment.vendorId === null &&
      assessment.assessmentRunId === null &&
      assessment.reviewAssignmentId === null;

    const lifecycleCertified =
      assessment.status === "DRAFT" &&
      assessment.sentAt === null &&
      assessment.submittedAt === null &&
      assessment.readyForReleaseAt === null &&
      assessment.releasedAt === null;

    const responsesCertified =
      responseCount === 301 &&
      answeredCount === 301 &&
      unansweredCount === 0 &&
      nonNullScoreCount === 0 &&
      missingRequiredEvidence === 0;

    const downstreamCertified =
      assessment.findings.length === 0 &&
      remediationCount === 0 &&
      assessment.attestations.length === 0 &&
      assessment.score === null &&
      assessment.maxScore === null &&
      assessment.riskLevel === null;

    const certified =
      identityCertified &&
      isolationCertified &&
      lifecycleCertified &&
      responsesCertified &&
      downstreamCertified;

    return NextResponse.json(
      {
        ok: certified,

        certification:
          "R46G.7G-E7-M.2F-R17.11",

        state:
          certified
            ? "CANARY_PRE_SUBMIT_CERTIFIED"
            : "CANARY_PRE_SUBMIT_NOT_CERTIFIED",

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

          framework: {
            id:
              assessment.framework.id,

            slug:
              assessment.framework.slug,

            name:
              assessment.framework.name,

            version:
              assessment.framework.version,
          },
        },

        responses: {
          responseCount,
          answeredCount,
          unansweredCount,
          nonNullScoreCount,
          requiredEvidenceCount,
          requiredAttestationCount,
          missingRequiredEvidence,
        },

        downstream: {
          findingCount:
            assessment.findings.length,

          remediationCount,

          attestationCount:
            assessment.attestations.length,
        },

        checks: {
          identityCertified,
          isolationCertified,
          lifecycleCertified,
          responsesCertified,
          downstreamCertified,
        },

        mutations: {
          assessmentCreated:
            false,

          assessmentUpdated:
            false,

          responsesUpdated:
            false,

          auditWritten:
            false,

          submitted:
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
          "R46G.7G-E7-M.2F-R17.11",

        state:
          "CANARY_PRE_SUBMIT_CERTIFICATION_FAILED",

        error:
          error instanceof Error
            ? error.message
            : String(error),

        mutations: {
          assessmentCreated:
            false,

          assessmentUpdated:
            false,

          responsesUpdated:
            false,

          auditWritten:
            false,

          submitted:
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
