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

const SUBMIT_AUDIT_ACTION =
  "FRAMEWORK_ASSESSMENT_SUBMITTED";

const FINDINGS_AUDIT_ACTION =
  "FRAMEWORK_FINDINGS_GENERATED";

const RELEASE_AUDIT_ACTIONS = [
  "FRAMEWORK_RELEASE_CONFIRMED",
  "FRAMEWORK_ASSESSMENT_RELEASED",
] as const;

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
          status: "READY_FOR_RELEASE",
          releasedAt: null,
          framework: {
            is: {
              slug: FRAMEWORK_SLUG,
              version: FRAMEWORK_VERSION,
            },
          },
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
            "R18.6AC.POST-FINDINGS",
          state:
            "R18_CANARY_POST_FINDINGS_NOT_FOUND",
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

    const releaseAudits =
      await prisma.auditLog.findMany({
        where: {
          entityType:
            "TruvernFrameworkAssessment",
          entityId:
            String(assessment.id),
          action: {
            in: [
              ...RELEASE_AUDIT_ACTIONS,
            ],
          },
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

    const metadata =
      assessment.metadata &&
      typeof assessment.metadata === "object" &&
      !Array.isArray(assessment.metadata)
        ? assessment.metadata
        : {};

    const findingsGeneratedAt =
      "findingsGeneratedAt" in metadata
        ? metadata.findingsGeneratedAt
        : null;

    const metadataRemediationRequired =
      "remediationRequired" in metadata
        ? metadata.remediationRequired
        : null;

    const metadataAttestationRequired =
      "attestationRequired" in metadata
        ? metadata.attestationRequired
        : null;

    const identityCertified =
      assessment.title ===
        CANARY_TITLE &&
      assessment.organizationId === null &&
      assessment.vendorId === null &&
      assessment.assessmentRunId === null &&
      assessment.reviewAssignmentId === null &&
      assessment.framework.slug ===
        FRAMEWORK_SLUG &&
      assessment.framework.version ===
        FRAMEWORK_VERSION;

    const lifecycleCertified =
      assessment.status ===
        "READY_FOR_RELEASE" &&
      assessment.submittedAt !== null &&
      assessment.readyForReleaseAt !== null &&
      assessment.releasedAt === null;

    const scoringCertified =
      assessment.score ===
        EXPECTED_RESPONSE_COUNT &&
      assessment.maxScore ===
        EXPECTED_RESPONSE_COUNT &&
      assessment.riskLevel === "LOW";

    const downstreamCertified =
      assessment._count.responses ===
        EXPECTED_RESPONSE_COUNT &&
      assessment._count.findings === 0 &&
      remediationCount === 0 &&
      assessment._count.attestations === 0;

    const scoreAuditCertified =
      scoreAudits.length === 1;

    const submitAuditCertified =
      submitAudits.length === 1;

    const findingsAuditCertified =
      findingsAudits.length === 1;

    const releaseAuditCertified =
      releaseAudits.length === 0;

    const metadataCertified =
      typeof findingsGeneratedAt === "string" &&
      findingsGeneratedAt.length > 0 &&
      metadataRemediationRequired === false &&
      metadataAttestationRequired === false;

    const certified =
      identityCertified &&
      lifecycleCertified &&
      scoringCertified &&
      downstreamCertified &&
      scoreAuditCertified &&
      submitAuditCertified &&
      findingsAuditCertified &&
      releaseAuditCertified &&
      metadataCertified;

    return NextResponse.json(
      {
        ok: certified,

        certification:
          "R18.6AC.POST-FINDINGS",

        state:
          certified
            ? "R18_CANARY_POST_FINDINGS_CERTIFIED"
            : "R18_CANARY_POST_FINDINGS_NOT_CERTIFIED",

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

        downstream: {
          responseCount:
            assessment._count.responses,
          findingCount:
            assessment._count.findings,
          remediationCount,
          attestationCount:
            assessment._count.attestations,
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
              scoreAudits[0] ?? null,
          },

          submission: {
            action:
              SUBMIT_AUDIT_ACTION,
            count:
              submitAudits.length,
            certified:
              submitAuditCertified,
            latest:
              submitAudits[0] ?? null,
          },

          findings: {
            action:
              FINDINGS_AUDIT_ACTION,
            count:
              findingsAudits.length,
            certified:
              findingsAuditCertified,
            latest:
              findingsAudits[0] ?? null,
          },

          release: {
            actions:
              RELEASE_AUDIT_ACTIONS,
            count:
              releaseAudits.length,
            certified:
              releaseAuditCertified,
            latest:
              releaseAudits[0] ?? null,
          },
        },

        metadata: {
          findingsGeneratedAt,
          remediationRequired:
            metadataRemediationRequired,
          attestationRequired:
            metadataAttestationRequired,
          certified:
            metadataCertified,
        },

        checks: {
          identityCertified,
          lifecycleCertified,
          scoringCertified,
          downstreamCertified,
          scoreAuditCertified,
          submitAuditCertified,
          findingsAuditCertified,
          releaseAuditCertified,
          metadataCertified,
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
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,

        certification:
          "R18.6AC.POST-FINDINGS",

        state:
          "R18_CANARY_POST_FINDINGS_CERTIFICATION_FAILED",

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
