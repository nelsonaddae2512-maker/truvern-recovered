import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import { requireReleasePacketAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

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

    const assessment = await prisma.truvernFrameworkAssessment.findUnique({
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

    const auditEvents = await prisma.$queryRawUnsafe<
      Array<{ id: number }>
    >(
      `
      select id
      from "AuditLog"
      where "entityType" = 'TruvernFrameworkAssessment'
        and "entityId" = $1
      `,
      String(assessmentId),
    );

    const origin = new URL(request.url).origin;

    return NextResponse.json({
      ok: true,
      manifestVersion: "truvern.framework-release-manifest.v1",

      assessment: {
        id: assessment.id,
        title: assessment.title,
        status: assessment.status,
        releasedAt: assessment.releasedAt,
      },

      framework: {
        id: assessment.frameworkId,
        name: assessment.framework?.name ?? null,
        version: assessment.framework?.version ?? null,
      },

      release: {
        sealed: Boolean(seal),
        sealedAt: seal?.sealedAt ?? assessment.releasedAt ?? null,
        checksum: seal?.checksum ?? null,
        algorithm: seal?.algorithm ?? "SHA-256",
        schema: snapshot?.schema ?? null,
      },

      inventory: {
        findings: assessment.findings.length,
        attestations: assessment.attestations.length,
        evidence:
          Array.isArray(snapshot?.evidence)
            ? snapshot.evidence.length
            : 0,
        auditEvents: auditEvents.length,
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

