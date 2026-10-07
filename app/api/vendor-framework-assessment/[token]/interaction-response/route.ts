import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

type JsonAnswer =
  | null
  | string
  | number
  | boolean
  | JsonAnswer[]
  | {
      [key: string]: JsonAnswer;
    };

function isJsonAnswer(
  value: unknown,
): value is JsonAnswer {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonAnswer);
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    return Object.values(
      value as Record<string, unknown>,
    ).every(isJsonAnswer);
  }

  return false;
}

function parseComponents(
  value: unknown,
): Array<
  Pick<
    TruvernInteractionComponentWrite,
    "responseId" | "componentId" | "mode" | "answer"
  >
> | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const parsed: Array<
    Pick<
      TruvernInteractionComponentWrite,
      "responseId" | "componentId" | "mode" | "answer"
    >
  > = [];

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
      typeof component.componentId !== "string" ||
      component.componentId.trim().length === 0 ||
      !isMode(component.mode) ||
      !Object.prototype.hasOwnProperty.call(
        component,
        "answer",
      ) ||
      !isJsonAnswer(component.answer)
    ) {
      return null;
    }

    parsed.push({
      responseId: component.responseId as number,
      componentId: component.componentId.trim(),
      mode: component.mode,
      answer:
        component.answer === null
          ? Prisma.JsonNull
          : component.answer,
    });
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

    const canonicalResponsesById =
      new Map(
        assessment.responses.map(
          (response) => [
            response.id,
            response,
          ] as const,
        ),
      );

    const resolvedComponents:
      TruvernInteractionComponentWrite[] = [];

    for (const component of components) {
      const canonicalResponse =
        canonicalResponsesById.get(
          component.responseId,
        );

      if (!canonicalResponse) {
        return NextResponse.json(
          {
            error:
              "Canonical response does not belong to the token-authorized assessment.",
          },
          {
            status: 404,
          },
        );
      }

      resolvedComponents.push({
        responseId:
          canonicalResponse.id,
        persistedQuestionId:
          canonicalResponse.questionId,
        canonicalControlId:
          canonicalResponse.question.control.controlId,
        componentId:
          component.componentId,
        mode:
          component.mode,
        answer:
          component.answer,
      });
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
        components: resolvedComponents,
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
