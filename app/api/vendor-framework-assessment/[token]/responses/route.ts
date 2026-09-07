import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { findVendorFrameworkAssessmentByToken } from "@/lib/auth/vendor-framework-assessment-token";
import { updateTruvernAssessmentResponse } from "@/lib/repositories/truvern-assessment-response-repository";
import { updateTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";

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

export async function PATCH(
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
          error: "Assessment has already been submitted.",
        },
        { status: 409 },
      );
    }

    const body =
      await request.json().catch(() => ({}));

    const responseId =
      parseId(body.responseId);

    if (!responseId) {
      return NextResponse.json(
        { ok: false, error: "responseId is required." },
        { status: 400 },
      );
    }

    const belongsToAssessment =
      assessment.responses.some(
        (response) => response.id === responseId,
      );

    if (!belongsToAssessment) {
      return NextResponse.json(
        { ok: false, error: "Response not found." },
        { status: 404 },
      );
    }

    const response =
      await updateTruvernAssessmentResponse({
        where: {
          id: responseId,
          assessmentId: assessment.id,
        },
        data: {
          answer:
            body.answer === undefined
              ? undefined
              : body.answer,
          vendorNotes:
            typeof body.vendorNotes === "string"
              ? body.vendorNotes
              : undefined,
          evidence:
            body.evidence === undefined
              ? undefined
              : body.evidence === null
                ? Prisma.JsonNull
                : (body.evidence as Prisma.InputJsonValue),
        },
      });

    await updateTruvernFrameworkAssessment({
      where: {
        id: assessment.id,
      },
      data: {
        status: "VENDOR_IN_PROGRESS",
      },
    });

    return NextResponse.json({
      ok: true,
      response,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save vendor response.",
      },
      { status: 500 },
    );
  }
}