import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { findVendorFrameworkAssessmentByToken } from "@/lib/auth/vendor-framework-assessment-token";
import { updateTruvernAssessmentResponse } from "@/lib/repositories/truvern-assessment-response-repository";
import {
  mergeVendorApplicabilityMetadata,
  parseVendorApplicabilityInput,
} from "@/lib/governance/questionnaires/truvern-questionnaire-applicability";
import {
  getTruvernVendorQuestionnaireComponentByQuestionId,
  truvernVendorQuestionnaireProjection,
} from "@/lib/governance/questionnaires/truvern-questionnaire-projection";
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

    const applicabilityResult =
      body.applicability === undefined
        ? null
        : parseVendorApplicabilityInput(
            body.applicability,
          );

    if (
      applicabilityResult &&
      !applicabilityResult.ok
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            applicabilityResult.error,
        },
        { status: 400 },
      );
    }

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

    const currentResponse =
      assessment.responses.find(
        (candidate) =>
          candidate.id === responseId,
      );

    if (!currentResponse) {
      return NextResponse.json(
        {
          ok: false,
          error: "Response not found.",
        },
        { status: 404 },
      );
    }

    if (applicabilityResult?.ok) {
      const certifiedProjection =
        getTruvernVendorQuestionnaireComponentByQuestionId(
          currentResponse.questionId,
        );

      if (!certifiedProjection) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Canonical response is not present in the certified questionnaire projection.",
          },
          { status: 400 },
        );
      }

      const vendorApplicability =
        applicabilityResult.value;

      if (
        vendorApplicability.profileId !==
          truvernVendorQuestionnaireProjection.profileId ||
        vendorApplicability.profileVersion !==
          truvernVendorQuestionnaireProjection.profileVersion ||
        vendorApplicability.interactionId !==
          certifiedProjection.interaction.interactionId ||
        vendorApplicability.componentId !==
          certifiedProjection.component.componentId
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Questionnaire projection identifiers do not match the canonical response.",
          },
          { status: 400 },
        );
      }
    }
    const nextMetadata =
      applicabilityResult?.ok
        ? mergeVendorApplicabilityMetadata(
            currentResponse.metadata,
            applicabilityResult.value,
          )
        : undefined;

    const response =
      await updateTruvernAssessmentResponse({
        where: {
          id: responseId,
          assessmentId: assessment.id,
        },
        data: {
          answer:
            applicabilityResult?.ok &&
            applicabilityResult.value.applicability ===
              "NOT_APPLICABLE"
              ? Prisma.JsonNull
              : body.answer === undefined
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
          metadata:
            nextMetadata,
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
