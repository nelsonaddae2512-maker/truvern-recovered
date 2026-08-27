import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CANARY_ID = 1;

const EXPECTED_TITLE =
  "TRUVERN R17 GOVERNANCE RELEASE CANARY — DO NOT USE";

const EXPECTED_FRAMEWORK_SLUG =
  "nist-800-53-rev5";

const EXPECTED_FRAMEWORK_VERSION =
  "5.2.0";

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
          status: true,
          score: true,
          maxScore: true,
          riskLevel: true,
          readyForReleaseAt: true,
          releasedAt: true,
          metadata: true,

          framework: {
            select: {
              slug: true,
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
          code: "CANARY_NOT_FOUND",
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
            assessmentId: CANARY_ID,
          },
        },
      });

    const unresolvedFindingCount =
      await prisma.truvernAssessmentFinding.count({
        where: {
          assessmentId: CANARY_ID,
          OR: [
            {
              remediationRequired: true,
              status: {
                in: [
                  "OPEN",
                  "REMEDIATION_REQUESTED",
                ],
              },
            },
            {
              attestationRequired: true,
              status: {
                in: [
                  "OPEN",
                  "REMEDIATION_REQUESTED",
                ],
              },
            },
          ],
        },
      });

    const unresolvedRemediationCount =
      await prisma.truvernRemediationRequest.count({
        where: {
          finding: {
            assessmentId: CANARY_ID,
          },
          status: {
            in: [
              "REQUESTED",
              "IN_PROGRESS",
              "SUBMITTED",
              "REJECTED",
            ],
          },
        },
      });

    const unresolvedAttestationCount =
      await prisma.truvernAssessmentAttestation.count({
        where: {
          assessmentId: CANARY_ID,
          status: {
            in: [
              "REQUESTED",
              "SUBMITTED",
              "REJECTED",
            ],
          },
        },
      });

    const scoreAuditCount =
      await prisma.auditLog.count({
        where: {
          entityType:
            "TruvernFrameworkAssessment",
          entityId:
            String(CANARY_ID),
          action:
            "FRAMEWORK_ASSESSMENT_SCORED",
        },
      });

    const findingsAuditCount =
      await prisma.auditLog.count({
        where: {
          entityType:
            "TruvernFrameworkAssessment",
          entityId:
            String(CANARY_ID),
          action:
            "FRAMEWORK_FINDINGS_GENERATED",
        },
      });

    const releaseAuditCount =
      await prisma.auditLog.count({
        where: {
          entityType:
            "TruvernFrameworkAssessment",
          entityId:
            String(CANARY_ID),
          action:
            "FRAMEWORK_RELEASE_CONFIRMED",
        },
      });

    const metadata =
      assessment.metadata &&
      typeof assessment.metadata === "object" &&
      !Array.isArray(assessment.metadata)
        ? assessment.metadata
        : {};

    const governanceReleaseSnapshot =
      "governanceReleaseSnapshot" in metadata
        ? metadata.governanceReleaseSnapshot
        : null;

    const governanceSeal =
      "governanceSeal" in metadata
        ? metadata.governanceSeal
        : null;

    /*
     * Certification 1:
     * exact isolated R17 canary identity.
     */
    const identityCertified =
      assessment.id === CANARY_ID &&
      assessment.title === EXPECTED_TITLE &&
      assessment.organizationId === null &&
      assessment.vendorId === null &&
      assessment.framework.slug ===
        EXPECTED_FRAMEWORK_SLUG &&
      assessment.framework.version ===
        EXPECTED_FRAMEWORK_VERSION;

    /*
     * Certification 2:
     * lifecycle is immediately before immutable release.
     */
    const lifecycleCertified =
      assessment.status === "READY_FOR_RELEASE" &&
      assessment.readyForReleaseAt !== null &&
      assessment.releasedAt === null;

    /*
     * Certification 3:
     * deterministic all-positive canary score.
     */
    const scoreCertified =
      assessment.score === 301 &&
      assessment.maxScore === 301 &&
      assessment.riskLevel === "LOW";

    /*
     * Certification 4:
     * all 301 framework responses remain present.
     */
    const responseCertified =
      assessment._count.responses === 301;

    /*
     * Certification 5:
     * no downstream governance work remains.
     */
    const downstreamCertified =
      assessment._count.findings === 0 &&
      remediationCount === 0 &&
      assessment._count.attestations === 0 &&
      unresolvedFindingCount === 0 &&
      unresolvedRemediationCount === 0 &&
      unresolvedAttestationCount === 0;

    /*
     * Certification 6:
     * upstream score/findings stages are auditable,
     * while release has never occurred.
     */
    const auditCertified =
      scoreAuditCount >= 1 &&
      findingsAuditCount >= 1 &&
      releaseAuditCount === 0;

    /*
     * Certification 7:
     * immutable release artifacts do not yet exist.
     */
    const unreleasedMetadataCertified =
      governanceReleaseSnapshot === null &&
      governanceSeal === null;


    const certified =
      identityCertified &&
      lifecycleCertified &&
      scoreCertified &&
      responseCertified &&
      downstreamCertified &&
      auditCertified &&
      unreleasedMetadataCertified;

    return NextResponse.json({
      ok: certified,

      code: certified
        ? "CANARY_ATOMIC_RELEASE_CERTIFIED"
        : "CANARY_ATOMIC_RELEASE_NOT_CERTIFIED",

      canary: {
        id: assessment.id,
        title: assessment.title,

        organizationId:
          assessment.organizationId,

        vendorId:
          assessment.vendorId,

        framework: {
          slug:
            assessment.framework.slug,
          version:
            assessment.framework.version,
        },

        status:
          assessment.status,

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

        responseCount:
          assessment._count.responses,

        findingCount:
          assessment._count.findings,

        remediationCount,

        attestationCount:
          assessment._count.attestations,

        unresolvedFindingCount,
        unresolvedRemediationCount,
        unresolvedAttestationCount,

        scoreAuditCount,
        findingsAuditCount,
        releaseAuditCount,

        governanceReleaseSnapshotPresent:
          governanceReleaseSnapshot !== null,

        governanceSealPresent:
          governanceSeal !== null,
      },

      certification: {
        identityCertified,
        lifecycleCertified,
        scoreCertified,
        responseCertified,
        downstreamCertified,
        auditCertified,
        unreleasedMetadataCertified,
        certified,
      },

      atomicReleaseContract: {
        transaction:
          "prisma.$transaction",
        assessmentTransition:
          "READY_FOR_RELEASE -> RELEASED",
        immutableSnapshotPersisted:
          true,
        governanceSealPersisted:
          true,
        cryptographicSignaturePersisted:
          true,
        auditAction:
          "FRAMEWORK_RELEASE_CONFIRMED",
        assessmentAndAuditSameTransaction:
          true,
      },

      mutationBoundary: {
        assessmentUpdated: false,
        responsesUpdated: false,
        auditWritten: false,
        releaseInvoked: false,
        signingInvoked: false,
        writePerformed: false,
      },
    });
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code:
          "CANARY_ATOMIC_RELEASE_CERTIFICATION_FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      },
    );
  }
}

