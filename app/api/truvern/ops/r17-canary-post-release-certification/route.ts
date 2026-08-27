import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  checksumSnapshot,
  stableJson,
} from "@/lib/governance/framework-release";
import { verifyGovernanceSignature } from "@/lib/governance-signature";

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
      assessment.status === "RELEASED" &&
      assessment.readyForReleaseAt !== null &&
      assessment.releasedAt !== null;

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
      releaseAuditCount === 1;

    /*
     * Certification 7:
     * immutable release artifacts do not yet exist.
     */
    const releasedMetadataCertified =
      governanceReleaseSnapshot !== null &&
      governanceSeal !== null;

    /*
     * Certification 8:
     * independently verify the immutable release cryptography
     * from the artifacts actually persisted in assessment metadata.
     */
    const snapshotRecord =
      governanceReleaseSnapshot &&
      typeof governanceReleaseSnapshot === "object" &&
      !Array.isArray(governanceReleaseSnapshot)
        ? governanceReleaseSnapshot
        : null;

    const sealRecord =
      governanceSeal &&
      typeof governanceSeal === "object" &&
      !Array.isArray(governanceSeal)
        ? governanceSeal
        : null;

    const signatureRecord =
      sealRecord &&
      "cryptographicSignature" in sealRecord &&
      sealRecord.cryptographicSignature &&
      typeof sealRecord.cryptographicSignature === "object" &&
      !Array.isArray(sealRecord.cryptographicSignature)
        ? sealRecord.cryptographicSignature
        : null;

    const persistedChecksum =
      sealRecord &&
      "checksum" in sealRecord &&
      typeof sealRecord.checksum === "string"
        ? sealRecord.checksum
        : null;

    const persistedSealAlgorithm =
      sealRecord &&
      "algorithm" in sealRecord &&
      typeof sealRecord.algorithm === "string"
        ? sealRecord.algorithm
        : null;

    const persistedSealSchema =
      sealRecord &&
      "schema" in sealRecord &&
      typeof sealRecord.schema === "string"
        ? sealRecord.schema
        : null;

    const persistedSealedAt =
      sealRecord &&
      "sealedAt" in sealRecord &&
      typeof sealRecord.sealedAt === "string"
        ? sealRecord.sealedAt
        : null;

    const persistedSealVersion =
      sealRecord &&
      "version" in sealRecord &&
      typeof sealRecord.version === "number"
        ? sealRecord.version
        : null;

    const persistedSignature =
      signatureRecord &&
      "signature" in signatureRecord &&
      typeof signatureRecord.signature === "string"
        ? signatureRecord.signature
        : null;

    const persistedSignatureAlgorithm =
      signatureRecord &&
      "algorithm" in signatureRecord &&
      typeof signatureRecord.algorithm === "string"
        ? signatureRecord.algorithm
        : null;

    const persistedSignedAt =
      signatureRecord &&
      "signedAt" in signatureRecord &&
      typeof signatureRecord.signedAt === "string"
        ? signatureRecord.signedAt
        : null;

    const persistedKeyId =
      signatureRecord &&
      "keyId" in signatureRecord &&
      typeof signatureRecord.keyId === "string"
        ? signatureRecord.keyId
        : null;

    const persistedPayloadHash =
      signatureRecord &&
      "payloadHash" in signatureRecord &&
      typeof signatureRecord.payloadHash === "string"
        ? signatureRecord.payloadHash
        : null;

    const recomputedChecksum =
      snapshotRecord
        ? checksumSnapshot(snapshotRecord as any)
        : null;

    const canonicalSnapshot =
      snapshotRecord
        ? JSON.parse(stableJson(snapshotRecord))
        : null;

    const recomputedPayloadHash =
      canonicalSnapshot
        ? crypto
            .createHash("sha256")
            .update(JSON.stringify(canonicalSnapshot))
            .digest("hex")
        : null;

    let signatureVerified = false;

    if (
      canonicalSnapshot &&
      persistedSignature &&
      persistedKeyId
    ) {
      try {
        signatureVerified =
          verifyGovernanceSignature(
            canonicalSnapshot,
            persistedSignature,
            persistedKeyId,
          );
      } catch {
        signatureVerified = false;
      }
    }

    const cryptographicIntegrityCertified =
      snapshotRecord !== null &&
      sealRecord !== null &&
      signatureRecord !== null &&
      persistedSealAlgorithm === "sha256" &&
      persistedSealVersion === 1 &&
      persistedChecksum !== null &&
      recomputedChecksum === persistedChecksum &&
      persistedSealSchema !== null &&
      "schema" in snapshotRecord &&
      snapshotRecord.schema === persistedSealSchema &&
      persistedSealedAt !== null &&
      assessment.releasedAt !== null &&
      persistedSealedAt === assessment.releasedAt.toISOString() &&
      persistedSignatureAlgorithm !== null &&
      persistedSignature !== null &&
      persistedSignature.length > 0 &&
      persistedSignedAt !== null &&
      persistedKeyId !== null &&
      persistedKeyId.length > 0 &&
      persistedPayloadHash !== null &&
      recomputedPayloadHash === persistedPayloadHash &&
      signatureVerified;


    const certified =
      identityCertified &&
      lifecycleCertified &&
      scoreCertified &&
      responseCertified &&
      downstreamCertified &&
      auditCertified &&
      releasedMetadataCertified &&
      cryptographicIntegrityCertified;

    return NextResponse.json({
      ok: certified,

      code: certified
        ? "CANARY_POST_RELEASE_CERTIFIED"
        : "CANARY_POST_RELEASE_NOT_CERTIFIED",

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
        releasedMetadataCertified,
        cryptographicIntegrityCertified,
        signatureVerified,
        checksumCertified:
          recomputedChecksum !== null &&
          recomputedChecksum === persistedChecksum,
        payloadHashCertified:
          recomputedPayloadHash !== null &&
          recomputedPayloadHash === persistedPayloadHash,
        certified,
      },

      atomicReleaseContract: {
        transaction:
          "prisma.$transaction",
        assessmentTransition:
          "READY_FOR_RELEASE -> RELEASED",
        immutableSnapshotPersisted:
          snapshotRecord !== null,
        governanceSealPersisted:
          sealRecord !== null,
        cryptographicSignaturePersisted:
          signatureRecord !== null &&
          persistedSignature !== null &&
          persistedSignature.length > 0,
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




