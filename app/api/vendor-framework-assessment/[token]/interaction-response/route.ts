import { NextResponse } from "next/server";
import {
  findVendorFrameworkAssessmentByToken,
} from "@/lib/auth/vendor-framework-assessment-token";
import {
  applyTruvernVendorInteractionResponse,
  type TruvernInteractionComponentWrite,
} from "@/lib/services/truvern-vendor-interaction-response-service";
import {
  updateTruvernFrameworkAssessment,
} from "@/lib/repositories/truvern-framework-assessment-repository";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type InteractionComponentBody = {
  responseId?: unknown;
  questionId?: unknown;
  componentId?: unknown;
  mode?: unknown;
  answer?: unknown;
};

type InteractionResponseBody = {
  interactionId?: unknown;
  sharedAnswer?: unknown;
  components?: unknown;
};

function isMode(
  value: unknown,
): value is "CONFIRMED" | "OVERRIDE" {
  return (
    value === "CONFIRMED" ||
    value === "OVERRIDE"
  );
}

function parseComponents(
  value: unknown,
): TruvernInteractionComponentWrite[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const parsed: TruvernInteractionComponentWrite[] = [];

  for (const raw of value) {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    ) {
      return null;
    }

    const component =
      raw as InteractionComponentBody;

    if (
      !Number.isInteger(component.responseId) ||
      !Number.isInteger(component.questionId) ||
      typeof component.componentId !== "string" ||
      component.componentId.trim().length === 0 ||
      !isMode(component.mode) ||
      !Object.prototype.hasOwnProperty.call(
        component,
        "answer",
      )
    ) {
      return null;
    }

    parsed.push({
      responseId: component.responseId as number,
      questionId: component.questionId as number,
      componentId: component.componentId.trim(),
      mode: component.mode,
      answer:
        component.answer === null
          ? null
          : component.answer,
    } as TruvernInteractionComponentWrite);
  }

  return parsed;
}

function classifyServiceError(
  error: unknown,
) {
  const message =
    error instanceof Error
      ? error.message
      : "Failed to save vendor interaction response.";

  if (
    message.includes(
      "does not belong to the assessment and question supplied",
    )
  ) {
    return {
      status: 404,
      message,
    };
  }

  if (
    message.includes(
      "certified questionnaire projection",
    ) ||
    message.includes(
      "Duplicate canonical response write requested",
    ) ||
    message.includes(
      "At least one canonical component must be supplied",
    ) ||
    message.includes(
      "does not belong to the requested interaction",
    ) ||
    message.includes(
      "does not match the certified interaction component",
    )
  ) {
    return {
      status: 400,
      message,
    };
  }

  return {
    status: 500,
    message,
  };
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const {
      token,
    } = await context.params;

    const assessment =
      await findVendorFrameworkAssessmentByToken(
        token,
      );

    if (!assessment) {
      return NextResponse.json(
        {
          error:
            "Vendor framework assessment not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (assessment.submittedAt) {
      return NextResponse.json(
        {
          error:
            "This vendor framework assessment has already been submitted.",
        },
        {
          status: 409,
        },
      );
    }

    let body: InteractionResponseBody;

    try {
      body =
        (await request.json()) as InteractionResponseBody;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON request body.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      typeof body.interactionId !== "string" ||
      body.interactionId.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error: "interactionId is required.",
        },
        {
          status: 400,
        },
      );
    }

    const components =
      parseComponents(body.components);

    if (!components) {
      return NextResponse.json(
        {
          error:
            "A non-empty valid component set is required.",
        },
        {
          status: 400,
        },
      );
    }

    const confirmedAt =
      new Date().toISOString();

    const result =
      await applyTruvernVendorInteractionResponse({
        assessmentId: assessment.id,
        interactionId:
          body.interactionId.trim(),
        sharedAnswer:
          body.sharedAnswer,
        confirmedAt,
        components,
      });

    await updateTruvernFrameworkAssessment(
      {
        where: {
          id: assessment.id,
        },
        data: {
          status: "VENDOR_IN_PROGRESS",
        },
      },
    );

    return NextResponse.json(
      {
        ok: true,
        interactionId:
          body.interactionId.trim(),
        confirmedAt,
        result,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    const classified =
      classifyServiceError(error);

    return NextResponse.json(
      {
        error: classified.message,
      },
      {
        status: classified.status,
      },
    );
  }
}

