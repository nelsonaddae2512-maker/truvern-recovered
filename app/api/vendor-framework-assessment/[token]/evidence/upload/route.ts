import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { writeGovernanceAuditLog } from "@/lib/governance/audit-log";
import { createEvidenceUploadUrl } from "@/lib/storage/evidence-storage";
import { findVendorFrameworkAssessmentByToken } from "@/lib/auth/vendor-framework-assessment-token";
import { findFirstTruvernAssessmentResponse, updateTruvernAssessmentResponse } from "@/lib/repositories/truvern-assessment-response-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ token: string }>;
};

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function evidenceArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;

  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as any).files)
  ) {
    return (value as any).files;
  }

  return [];
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { token } = await context.params;

    const assessment =
      await findVendorFrameworkAssessmentByToken(token);

    if (!assessment) {
      return NextResponse.json(
        { ok: false, error: "Assessment not found." },
        { status: 404 },
      );
    }

    if (assessment.submittedAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "Response evidence cannot be added after assessment submission.",
        },
        { status: 409 },
      );
    }

    const body =
      await request.json().catch(() => ({}));

    const responseId =
      parseId(body.responseId);

    const filename =
      typeof body.filename === "string"
        ? body.filename
        : "";

    const contentType =
      typeof body.contentType === "string"
        ? body.contentType
        : "";

    const sizeBytes =
      parseId(body.sizeBytes) ?? null;

    if (!responseId) {
      return NextResponse.json(
        { ok: false, error: "responseId is required." },
        { status: 400 },
      );
    }

    const response =
      await findFirstTruvernAssessmentResponse({
        where: {
          id: responseId,
          assessmentId: assessment.id,
        },
        select: {
          id: true,
          evidence: true,
        },
      });

    if (!response) {
      return NextResponse.json(
        { ok: false, error: "Response not found." },
        { status: 404 },
      );
    }

    const upload =
      await createEvidenceUploadUrl({
        assessmentId: assessment.id,
        responseId,
        filename,
        contentType,
        sizeBytes,
      });

    const files =
      evidenceArray(response.evidence);

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

    await updateTruvernAssessmentResponse({
      where: {
        id: responseId,
      },
      data: {
        evidence: evidence as Prisma.InputJsonValue,
      },
    });

    await writeGovernanceAuditLog({
      organizationId: assessment.organizationId,
      entityType: "TruvernFrameworkAssessment",
      entityId: assessment.id,
      action: "FRAMEWORK_EVIDENCE_UPLOAD_URL_CREATED",
      message: "Vendor evidence upload URL was created.",
      metadata: {
        scope: "evidence",
        responseId,
        evidenceId: upload.evidenceId,
        key: upload.key,
        filename: upload.filename,
        source: "vendor-framework-assessment-token",
      },
    });

    return NextResponse.json({
      ok: true,
      upload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create evidence upload URL.",
      },
      { status: 500 },
    );
  }
}