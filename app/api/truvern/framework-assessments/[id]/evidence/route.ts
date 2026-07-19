import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireReviewerAccess, requireFrameworkAssessmentAccess } from "@/lib/auth/truvern-governance";
import { createEvidenceDownloadUrl } from "@/lib/storage/evidence-storage";

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

function evidenceFiles(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as any).files)) {
    return (value as any).files;
  }
  return [];
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const assessmentId = parseId(rawId);

    if (!assessmentId) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    await requireReviewerAccess();
    await requireFrameworkAssessmentAccess(assessmentId);

    const assessment = await prisma.truvernFrameworkAssessment.findUnique({
      where: { id: assessmentId },
      include: {
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
            remediations: true,
          },
        },
        attestations: true,
      },
    });

    if (!assessment) {
      return NextResponse.json({ ok: false, error: "Assessment not found." }, { status: 404 });
    }

    const evidence: any[] = [];

    for (const response of assessment.responses) {
      for (const file of evidenceFiles(response.evidence)) {
        evidence.push({
          ...file,
          scope: "response",
          responseId: response.id,
          questionId: response.questionId,
          controlId: response.question.control.controlId,
          controlTitle: response.question.control.title,
          prompt: response.question.prompt,
        });
      }
    }

    for (const finding of assessment.findings) {
      for (const remediation of finding.remediations) {
        const metadata =
          remediation.metadata && typeof remediation.metadata === "object"
            ? (remediation.metadata as any)
            : {};

        for (const file of evidenceFiles(metadata.evidence)) {
          evidence.push({
            ...file,
            scope: "remediation",
            findingId: finding.id,
            remediationId: remediation.id,
            findingTitle: finding.title,
            remediationStatus: remediation.status,
          });
        }
      }
    }

    for (const attestation of assessment.attestations) {
      for (const file of evidenceFiles(attestation.evidence)) {
        evidence.push({
          ...file,
          scope: "attestation",
          attestationId: attestation.id,
          attestationTitle: attestation.title,
          attestationStatus: attestation.status,
        });
      }
    }

    const withUrls = await Promise.all(
      evidence.map(async (file) => ({
        ...file,
        downloadUrl: file.key ? await createEvidenceDownloadUrl(file.key) : null,
        downloadUrlExpiresInSeconds: file.key ? 300 : null,
      })),
    );

    return NextResponse.json({
      ok: true,
      assessmentId,
      count: withUrls.length,
      evidence: withUrls,
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load framework assessment evidence.",
      },
      { status: 500 },
    );
  }
}




