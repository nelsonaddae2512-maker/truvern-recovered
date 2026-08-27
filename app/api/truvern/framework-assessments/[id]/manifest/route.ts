import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import { requireReleasePacketAccess } from "@/lib/auth/truvern-governance";
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

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const assessmentId = parseId(rawId);

    if (!assessmentId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid assessment id.",
        },
        { status: 400 },
      );
    }

    await requireReleasePacketAccess(assessmentId);

    const assessment = await findTruvernFrameworkAssessment({
      where: {
        id: assessmentId,
      },
      include: {
        framework: true,
        findings: true,
        attestations: true,
      },
    });

    if (!assessment) {
      return NextResponse.json(
        {
          ok: false,
          error: "Assessment not found.",
        },
        { status: 404 },
      );
    }

    const metadata =
      assessment.metadata && typeof assessment.metadata === "object"
        ? (assessment.metadata as any)
        : {};

    const snapshot = metadata.governanceReleaseSnapshot ?? null;
    const seal = metadata.governanceSeal ?? null;
    /*
     * Immutable release-manifest projection.
     *
     * Release-facing identity and inventory derive from
     * the persisted governance snapshot and seal only.
     */
    const releasedAssessment =
      snapshot?.assessment &&
      typeof snapshot.assessment === "object"
        ? snapshot.assessment as any
        : {};

    const releasedFramework =
      snapshot?.framework &&
      typeof snapshot.framework === "object"
        ? snapshot.framework as any
        : {};

    const releasedFindings =
      Array.isArray(snapshot?.findings)
        ? snapshot.findings
        : [];

    const releasedAttestations =
      Array.isArray(snapshot?.attestations)
        ? snapshot.attestations
        : [];

    const releasedEvidence =
      Array.isArray(snapshot?.evidence)
        ? snapshot.evidence
        : [];

    const manifestReleasedAt =
      seal?.sealedAt ??
      releasedAssessment.releasedAt ??
      snapshot?.generatedAt ??
      null;
    const origin = new URL(request.url).origin;

    return NextResponse.json({
      ok: true,
      manifestVersion: "truvern.framework-release-manifest.v1",

      assessment: {
        id: releasedAssessment.id ?? assessmentId,
        title: releasedAssessment.title ?? null,
        status: releasedAssessment.status ?? null,
        releasedAt: manifestReleasedAt,
      },

      framework: {
        id: releasedFramework.id ?? null,
        name: releasedFramework.name ?? null,
        version: releasedFramework.version ?? null,
      },

      release: {
        sealed: Boolean(seal),
        sealedAt: seal?.sealedAt ?? manifestReleasedAt,
        checksum: seal?.checksum ?? null,
        algorithm: seal?.algorithm ?? "SHA-256",
        schema: snapshot?.schema ?? null,
        /*
         * Public detached-signature identity.
         *
         * Projected verbatim from the persisted governance seal.
         * This route never signs or reconstructs the released payload.
         */
        cryptographicSignature:
          seal?.cryptographicSignature
            ? {
                algorithm:
                  seal.cryptographicSignature.algorithm ?? null,

                keyId:
                  seal.cryptographicSignature.keyId ?? null,

                signedAt:
                  seal.cryptographicSignature.signedAt ?? null,

                payloadHash:
                  seal.cryptographicSignature.payloadHash ?? null,

                signature:
                  seal.cryptographicSignature.signature ?? null,
              }
            : null,
      },

      inventory: {
        findings: releasedFindings.length,
        attestations: releasedAttestations.length,
        evidence: releasedEvidence.length,
        auditEvents: null,
      },

      endpoints: {
        packetHtml:
          `${origin}/api/truvern/framework-assessments/${assessmentId}/packet`,
        packetPdf:
          `${origin}/api/truvern/framework-assessments/${assessmentId}/packet/pdf`,
        verify:
          `${origin}/api/truvern/framework-assessments/${assessmentId}/verify`,
        manifest:
          `${origin}/api/truvern/framework-assessments/${assessmentId}/manifest`,
      },
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate framework release manifest.",
      },
      { status: 500 },
    );
  }
}

