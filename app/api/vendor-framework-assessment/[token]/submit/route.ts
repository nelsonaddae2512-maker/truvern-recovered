import { NextResponse } from "next/server";
import { writeGovernanceAuditLog } from "@/lib/governance/audit-log";
import { findVendorFrameworkAssessmentByToken } from "@/lib/auth/vendor-framework-assessment-token";
import { updateTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ token: string }>;
};

function hasAnswer(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
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

    const vendorUrl =
      `/vendor-framework-assessment/${encodeURIComponent(token)}`;

    if (assessment.submittedAt) {
      return NextResponse.redirect(
        new URL(`${vendorUrl}?submitted=1`, request.url),
        { status: 303 },
      );
    }

    const incompleteResponses =
      assessment.responses.filter(
        (response) => !hasAnswer(response.answer),
      );

    if (incompleteResponses.length > 0) {
      return NextResponse.redirect(
        new URL(
          `${vendorUrl}?submitError=incomplete&missing=${incompleteResponses.length}`,
          request.url,
        ),
        { status: 303 },
      );
    }

    const submitted =
      await updateTruvernFrameworkAssessment({
        where: {
          id: assessment.id,
        },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
        include: {
          framework: true,
          responses: true,
        },
      });

    await writeGovernanceAuditLog({
      organizationId: submitted.organizationId,
      entityType: "TruvernFrameworkAssessment",
      entityId: submitted.id,
      action: "FRAMEWORK_ASSESSMENT_SUBMITTED",
      message: "Framework assessment was submitted for Truvern review.",
      metadata: {
        frameworkId: submitted.frameworkId,
        responseCount: submitted.responses.length,
        source: "vendor-framework-assessment-token",
      },
    });

    return NextResponse.redirect(
      new URL(`${vendorUrl}?submitted=1`, request.url),
      { status: 303 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit assessment.",
      },
      { status: 500 },
    );
  }
}