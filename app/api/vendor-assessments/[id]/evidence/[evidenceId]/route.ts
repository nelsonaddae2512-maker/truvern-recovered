import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireVendorAssessmentAccess } from "@/lib/auth/truvern-governance";
import { createEvidenceDownloadUrl } from "@/lib/storage/evidence-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string; evidenceId: string }>;
};

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function findEvidenceFile(value: unknown, evidenceId: string): any | null {
  if (Array.isArray(value)) {
    return value.find((file) => file?.evidenceId === evidenceId) ?? null;
  }

  if (value && typeof value === "object" && Array.isArray((value as any).files)) {
    return (value as any).files.find((file: any) => file?.evidenceId === evidenceId) ?? null;
  }

  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: rawId, evidenceId } = await context.params;
    const assessmentId = parseId(rawId);

    if (!assessmentId) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    await requireVendorAssessmentAccess(assessmentId);

    const assessment = await prisma.truvernFrameworkAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        responses: {
          select: { evidence: true },
        },
        findings: {
          include: {
            remediations: {
              select: { metadata: true },
            },
          },
        },
        attestations: {
          select: { evidence: true },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json({ ok: false, error: "Assessment not found." }, { status: 404 });
    }

    for (const response of assessment.responses) {
      const file = findEvidenceFile(response.evidence, evidenceId);
      if (file?.key) {
        const downloadUrl = await createEvidenceDownloadUrl(file.key);
        return NextResponse.json({ ok: true, evidence: file, downloadUrl, expiresInSeconds: 300 });
      }
    }

    for (const finding of assessment.findings) {
      for (const remediation of finding.remediations) {
        const metadata = remediation.metadata && typeof remediation.metadata === "object" ? remediation.metadata as any : {};
        const file = findEvidenceFile(metadata.evidence, evidenceId);
        if (file?.key) {
          const downloadUrl = await createEvidenceDownloadUrl(file.key);
          return NextResponse.json({ ok: true, evidence: file, downloadUrl, expiresInSeconds: 300 });
        }
      }
    }

    for (const attestation of assessment.attestations) {
      const file = findEvidenceFile(attestation.evidence, evidenceId);
      if (file?.key) {
        const downloadUrl = await createEvidenceDownloadUrl(file.key);
        return NextResponse.json({ ok: true, evidence: file, downloadUrl, expiresInSeconds: 300 });
      }
    }

    return NextResponse.json({ ok: false, error: "Evidence file not found." }, { status: 404 });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to create evidence download URL.",
      },
      { status: 500 },
    );
  }
}




