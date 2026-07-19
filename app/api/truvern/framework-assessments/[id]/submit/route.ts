import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { writeGovernanceAuditLog } from "@/lib/governance/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function hasAnswer(value: unknown) {
  if (value === null || value === undefined) return false;

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Invalid assessment id." },
        { status: 400 },
      );
    }

    const existing = await prisma.truvernFrameworkAssessment.findUnique({
      where: { id },
      include: {
        framework: true,
        responses: {
          include: {
            question: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Assessment not found." },
        { status: 404 },
      );
    }

    const incompleteResponses = existing.responses.filter((response) => {
      return !hasAnswer(response.answer);
    });

    if (incompleteResponses.length > 0) {
      const redirectUrl = new URL(
        `/vendor-assessments/${existing.id}?submitError=incomplete&missing=${incompleteResponses.length}`,
        request.url,
      );

      return NextResponse.redirect(redirectUrl, { status: 303 });
    }

    const assessment = await prisma.truvernFrameworkAssessment.update({
      where: { id },
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
      organizationId: assessment.organizationId,
      entityType: "TruvernFrameworkAssessment",
      entityId: assessment.id,
      action: "FRAMEWORK_ASSESSMENT_SUBMITTED",
      message: "Framework assessment was submitted for Truvern review.",
      metadata: {
        frameworkId: assessment.frameworkId,
        responseCount: assessment.responses.length,
      },
    });

    const accept = request.headers.get("accept") || "";

    if (accept.includes("application/json")) {
      return NextResponse.json({
        ok: true,
        assessmentId: assessment.id,
        status: assessment.status,
        next: {
          assessmentUrl: `/vendor-assessments/${assessment.id}?submitted=1`,
        },
      });
    }

    return NextResponse.redirect(
      new URL(`/vendor-assessments/${assessment.id}?submitted=1`, request.url),
      { status: 303 },
    );
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

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
