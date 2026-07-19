import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { writeGovernanceAuditLog } from "@/lib/governance/audit-log";
import { requireVendorAssessmentAccess } from "@/lib/auth/truvern-governance";
import { createEvidenceUploadUrl } from "@/lib/storage/evidence-storage";

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

function evidenceArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as any).files)) {
    return (value as any).files;
  }
  return [];
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const assessmentId = parseId(rawId);

    if (!assessmentId) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    await requireVendorAssessmentAccess(assessmentId);

    const body = await request.json().catch(() => ({}));
    const responseId = parseId(body.responseId);
    const remediationId = parseId(body.remediationId);
    const attestationId = parseId(body.attestationId);

    const filename = typeof body.filename === "string" ? body.filename : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const sizeBytes = parseId(body.sizeBytes) ?? null;

    if (!responseId && !remediationId && !attestationId) {
      return NextResponse.json(
        { ok: false, error: "responseId, remediationId, or attestationId is required." },
        { status: 400 },
      );
    }

    const assessment = await prisma.truvernFrameworkAssessment.findUnique({
      where: { id: assessmentId },
      select: { id: true },
    });

    if (!assessment) {
      return NextResponse.json({ ok: false, error: "Assessment not found." }, { status: 404 });
    }

    if (responseId) {
      const response = await prisma.truvernAssessmentResponse.findFirst({
        where: { id: responseId, assessmentId },
        select: { id: true, evidence: true },
      });

      if (!response) {
        return NextResponse.json({ ok: false, error: "Response not found." }, { status: 404 });
      }

      const upload = await createEvidenceUploadUrl({
        assessmentId,
        responseId,
        filename,
        contentType,
        sizeBytes,
      });

      const files = evidenceArray(response.evidence);
      const evidence = {
        files: [
          ...files,
          {
            ...upload,
            status: "PENDING_UPLOAD",
            createdAt: new Date().toISOString(),
            scope: "response",
          },
        ],
      };

      await prisma.truvernAssessmentResponse.update({
        where: { id: responseId },
        data: {
          evidence: evidence as Prisma.InputJsonValue,
        },
      });

      await writeGovernanceAuditLog({
        organizationId: null,
        entityType: "TruvernFrameworkAssessment",
        entityId: assessmentId,
        action: "FRAMEWORK_EVIDENCE_UPLOAD_URL_CREATED",
        message: "Vendor evidence upload URL was created.",
        metadata: {
          scope: "evidence",
          responseId,
          remediationId,
          attestationId,
          evidenceId: upload.evidenceId,
          key: upload.key,
          filename: upload.filename,
        },
      });

      return NextResponse.json({ ok: true, upload });
    }

    if (remediationId) {
      const remediation = await prisma.truvernRemediationRequest.findFirst({
        where: { id: remediationId, finding: { assessmentId } },
        select: { id: true, metadata: true },
      });

      if (!remediation) {
        return NextResponse.json({ ok: false, error: "Remediation request not found." }, { status: 404 });
      }

      const upload = await createEvidenceUploadUrl({
        assessmentId,
        remediationId,
        filename,
        contentType,
        sizeBytes,
      });

      const metadata = remediation.metadata && typeof remediation.metadata === "object" ? remediation.metadata as any : {};
      const files = evidenceArray(metadata.evidence);

      await prisma.truvernRemediationRequest.update({
        where: { id: remediationId },
        data: {
          metadata: {
            ...metadata,
            evidence: {
              files: [
                ...files,
                {
                  ...upload,
                  status: "PENDING_UPLOAD",
                  createdAt: new Date().toISOString(),
                  scope: "remediation",
                },
              ],
            },
          } as Prisma.InputJsonValue,
        },
      });

      await writeGovernanceAuditLog({
        organizationId: null,
        entityType: "TruvernFrameworkAssessment",
        entityId: assessmentId,
        action: "FRAMEWORK_EVIDENCE_UPLOAD_URL_CREATED",
        message: "Vendor evidence upload URL was created.",
        metadata: {
          scope: "evidence",
          responseId,
          remediationId,
          attestationId,
          evidenceId: upload.evidenceId,
          key: upload.key,
          filename: upload.filename,
        },
      });

      return NextResponse.json({ ok: true, upload });
    }

    const attestation = await prisma.truvernAssessmentAttestation.findFirst({
      where: { id: attestationId!, assessmentId },
      select: { id: true, evidence: true },
    });

    if (!attestation) {
      return NextResponse.json({ ok: false, error: "Attestation request not found." }, { status: 404 });
    }

    const upload = await createEvidenceUploadUrl({
      assessmentId,
      attestationId,
      filename,
      contentType,
      sizeBytes,
    });

    const files = evidenceArray(attestation.evidence);
    const evidence = {
      files: [
        ...files,
        {
          ...upload,
          status: "PENDING_UPLOAD",
          createdAt: new Date().toISOString(),
          scope: "attestation",
        },
      ],
    };

    await prisma.truvernAssessmentAttestation.update({
      where: { id: attestationId! },
      data: {
        evidence: evidence as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ ok: true, upload });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to create evidence upload URL.",
      },
      { status: 500 },
    );
  }
}







