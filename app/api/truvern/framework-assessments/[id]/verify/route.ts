import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireReleasePacketAccess } from "@/lib/auth/truvern-governance";
import {
  buildFrameworkReleaseSnapshot,
  checksumSnapshot,
} from "@/lib/governance/framework-release";
import { verifyGovernanceSignature } from "@/lib/governance-signature";
import { stableJson } from "@/lib/governance/framework-release";
import { findTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";

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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const assessmentId = parseId(rawId);

    if (!assessmentId) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    await requireReleasePacketAccess(assessmentId);

    const assessment = await findTruvernFrameworkAssessment({
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

    const metadata = assessment.metadata && typeof assessment.metadata === "object" ? assessment.metadata as any : {};
    const seal = metadata.governanceSeal ?? null;
    const storedSnapshot = metadata.governanceReleaseSnapshot ?? null;

    if (!seal || !storedSnapshot) {
      return NextResponse.json({
        ok: true,
        verified: false,
        reason: "Assessment has not been released or sealed.",
      });
    }

    const recalculatedFromStored =
      checksumSnapshot(
        storedSnapshot
      );

    const checksumVerified =
      recalculatedFromStored ===
      seal.checksum;

    const sealRecord =
      seal &&
      typeof seal === "object" &&
      !Array.isArray(seal)
        ? seal as Record<string, unknown>
        : null;

    const signatureCandidate =
      sealRecord
        ?.cryptographicSignature;

    const cryptographicSignature =
      signatureCandidate &&
      typeof signatureCandidate === "object" &&
      !Array.isArray(
        signatureCandidate
      )
        ? signatureCandidate as Record<string, unknown>
        : null;

    const signatureValue =
      typeof cryptographicSignature
        ?.signature === "string"
        ? cryptographicSignature.signature
        : null;

    const signingKeyId =
      typeof cryptographicSignature
        ?.keyId === "string"
        ? cryptographicSignature.keyId
        : null;

    /*
     * Backward compatibility:
     *
     * Releases created before E7-K have no detached
     * signature and remain checksum-verifiable.
     *
     * New releases require both the historical checksum
     * and RSA signature to verify.
     */
    /*
     * Reconstruct the same canonical payload that was signed.
     *
     * This makes verification invariant to JSON/JSONB
     * property ordering after persistence.
     */
    const canonicalStoredSnapshot =
      JSON.parse(
        stableJson(
          storedSnapshot
        )
      );

    const cryptographicVerified =
      signatureValue &&
      signingKeyId
        ? verifyGovernanceSignature(
            canonicalStoredSnapshot,
            signatureValue,
            signingKeyId,
          )
        : null;
    const currentSnapshot = buildFrameworkReleaseSnapshot(assessment);
    /*
     * Historical authenticity and current-state drift are
     * independent verification concerns.
     *
     * Release mechanics may change generatedAt and lifecycle
     * fields. Normalize only those fields to their sealed values
     * before checking for substantive post-release drift.
     */
    const storedAssessment =
      storedSnapshot.assessment &&
      typeof storedSnapshot.assessment === "object" &&
      !Array.isArray(storedSnapshot.assessment)
        ? storedSnapshot.assessment as Record<string, unknown>
        : null;

    const currentAssessment =
      currentSnapshot.assessment &&
      typeof currentSnapshot.assessment === "object" &&
      !Array.isArray(currentSnapshot.assessment)
        ? currentSnapshot.assessment as Record<string, unknown>
        : null;

    if (
      !storedAssessment ||
      !currentAssessment
    ) {
      return NextResponse.json(
        {
          verified: false,
          reason: "INVALID_RELEASE_SNAPSHOT_ASSESSMENT",
        },
        {
          status: 409,
        },
      );
    }

    const comparableCurrentSnapshot = {
      ...currentSnapshot,

      generatedAt:
        storedSnapshot.generatedAt,

      assessment: {
        ...currentAssessment,

        /*
         * These fields change only because confirm-release
         * transitions/persists the assessment.
         *
         * Use the sealed values exactly. In particular,
         * releasedAt=null is meaningful and MUST NOT use ??
         * because null is the expected pre-release value.
         */
        status:
          storedAssessment.status,

        releasedAt:
          storedAssessment.releasedAt,

        updatedAt:
          storedAssessment.updatedAt,
      },
    };

    const recalculatedFromCurrent =
      checksumSnapshot(
        comparableCurrentSnapshot
      );

    return NextResponse.json({
      ok: true,
      verified:
        checksumVerified &&
        (
          cryptographicVerified ===
            null ||
          cryptographicVerified ===
            true
        ),

      checksumVerified,

      cryptographicallySigned:
        cryptographicSignature !==
        null,

      cryptographicVerified,

      signature:
        cryptographicSignature
          ? {
              algorithm:
                typeof cryptographicSignature.algorithm ===
                "string"
                  ? cryptographicSignature.algorithm
                  : null,

              keyId:
                signingKeyId,

              signedAt:
                typeof cryptographicSignature.signedAt ===
                "string"
                  ? cryptographicSignature.signedAt
                  : null,

              payloadHash:
                typeof cryptographicSignature.payloadHash ===
                "string"
                  ? cryptographicSignature.payloadHash
                  : null,
            }
          : null,
      storedChecksum: seal.checksum,
      recalculatedFromStored,
      currentChecksum: recalculatedFromCurrent,
      currentMatchesReleasedSnapshot: recalculatedFromCurrent === seal.checksum,
      seal,
      schema: storedSnapshot.schema,
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to verify framework assessment release.",
      },
      { status: 500 },
    );
  }
}




