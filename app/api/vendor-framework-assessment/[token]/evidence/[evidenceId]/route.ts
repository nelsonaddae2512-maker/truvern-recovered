import { NextResponse } from "next/server";
import { createEvidenceDownloadUrl } from "@/lib/storage/evidence-storage";
import { findVendorFrameworkAssessmentByToken } from "@/lib/auth/vendor-framework-assessment-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    token: string;
    evidenceId: string;
  }>;
};

function findEvidenceFile(
  value: unknown,
  evidenceId: string,
): any | null {
  if (Array.isArray(value)) {
    return (
      value.find(
        (file) => file?.evidenceId === evidenceId,
      ) ?? null
    );
  }

  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as any).files)
  ) {
    return (
      (value as any).files.find(
        (file: any) =>
          file?.evidenceId === evidenceId,
      ) ?? null
    );
  }

  return null;
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const {
      token,
      evidenceId,
    } = await context.params;

    const assessment =
      await findVendorFrameworkAssessmentByToken(token);

    if (!assessment) {
      return NextResponse.json(
        { ok: false, error: "Assessment not found." },
        { status: 404 },
      );
    }

    for (const response of assessment.responses) {
      const file =
        findEvidenceFile(
          response.evidence,
          evidenceId,
        );

      if (file?.key) {
        const downloadUrl =
          await createEvidenceDownloadUrl(file.key);

        return NextResponse.json({
          ok: true,
          evidence: file,
          downloadUrl,
          expiresInSeconds: 300,
        });
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Evidence file not found.",
      },
      { status: 404 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create evidence download URL.",
      },
      { status: 500 },
    );
  }
}