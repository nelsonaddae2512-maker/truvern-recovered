import type { Prisma } from "@prisma/client";

export const TRUVERN_QUESTIONNAIRE_PROJECTION_METADATA_KEY =
  "truvernQuestionnaireProjection" as const;

export const TRUVERN_APPLICABILITY_STATES = [
  "APPLICABLE",
  "NOT_APPLICABLE",
  "UNRESOLVED",
] as const;

export type TruvernApplicabilityState =
  (typeof TRUVERN_APPLICABILITY_STATES)[number];

export type TruvernQuestionnaireProjectionMetadata = {
  profileId: string;
  profileVersion: string;
  interactionId: string;
  componentId: string;
  applicability: TruvernApplicabilityState;
  notApplicableJustification: string | null;
  notApplicableReviewerAccepted: boolean;
};

export type TruvernApplicabilityInput = {
  profileId: string;
  profileVersion: string;
  interactionId: string;
  componentId: string;
  applicability: TruvernApplicabilityState;
  notApplicableJustification?: string | null;
};

export type TruvernSubmissionCompleteness = {
  complete: boolean;
  reason:
    | "ANSWER_REQUIRED"
    | "NOT_APPLICABLE_JUSTIFICATION_REQUIRED"
    | "UNRESOLVED_APPLICABILITY"
    | null;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function nonEmptyString(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function hasAnswer(
  value: unknown,
): boolean {
  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

export function isTruvernApplicabilityState(
  value: unknown,
): value is TruvernApplicabilityState {
  return (
    typeof value === "string" &&
    (
      TRUVERN_APPLICABILITY_STATES as readonly string[]
    ).includes(value)
  );
}

export function parseVendorApplicabilityInput(
  value: unknown,
):
  | {
      ok: true;
      value: TruvernApplicabilityInput;
    }
  | {
      ok: false;
      error: string;
    } {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "applicability must be an object.",
    };
  }

  if (
    Object.prototype.hasOwnProperty.call(
      value,
      "notApplicableReviewerAccepted",
    )
  ) {
    return {
      ok: false,
      error:
        "Reviewer acceptance cannot be set by the vendor.",
    };
  }

  const profileId =
    nonEmptyString(value.profileId);

  const profileVersion =
    nonEmptyString(value.profileVersion);

  const interactionId =
    nonEmptyString(value.interactionId);

  const componentId =
    nonEmptyString(value.componentId);

  if (!profileId) {
    return {
      ok: false,
      error: "profileId is required.",
    };
  }

  if (!profileVersion) {
    return {
      ok: false,
      error: "profileVersion is required.",
    };
  }

  if (!interactionId) {
    return {
      ok: false,
      error: "interactionId is required.",
    };
  }

  if (!componentId) {
    return {
      ok: false,
      error: "componentId is required.",
    };
  }

  if (
    !isTruvernApplicabilityState(
      value.applicability,
    )
  ) {
    return {
      ok: false,
      error:
        "Invalid applicability state.",
    };
  }

  const justification =
    nonEmptyString(
      value.notApplicableJustification,
    );

  if (
    value.applicability ===
      "NOT_APPLICABLE" &&
    !justification
  ) {
    return {
      ok: false,
      error:
        "A justification is required when a response is not applicable.",
    };
  }

  return {
    ok: true,
    value: {
      profileId,
      profileVersion,
      interactionId,
      componentId,
      applicability:
        value.applicability,
      notApplicableJustification:
        value.applicability ===
        "NOT_APPLICABLE"
          ? justification
          : null,
    },
  };
}

export function mergeVendorApplicabilityMetadata(
  existingMetadata: unknown,
  input: TruvernApplicabilityInput,
): Prisma.InputJsonValue {
  const existing =
    isRecord(existingMetadata)
      ? existingMetadata
      : {};

  const rawExistingProjection =
    existing[
      TRUVERN_QUESTIONNAIRE_PROJECTION_METADATA_KEY
    ];

  const existingProjection =
    isRecord(rawExistingProjection)
      ? rawExistingProjection
      : {};


  const projection:
    TruvernQuestionnaireProjectionMetadata = {
      profileId: input.profileId,
      profileVersion: input.profileVersion,
      interactionId: input.interactionId,
      componentId: input.componentId,
      applicability: input.applicability,
      notApplicableJustification:
        input.applicability ===
        "NOT_APPLICABLE"
          ? (
              input.notApplicableJustification ??
              null
            )
          : null,
      /*
       * Any vendor-authored applicability write invalidates
       * a prior reviewer acceptance. Governance must accept
       * the resulting N/A assertion again after the vendor's
       * latest representation.
       */
      notApplicableReviewerAccepted: false,
    };

  return JSON.parse(
    JSON.stringify({
      ...existing,
      [TRUVERN_QUESTIONNAIRE_PROJECTION_METADATA_KEY]:
        projection,
    }),
  ) as Prisma.InputJsonValue;
}

export function readTruvernApplicability(
  metadata: unknown,
):
  | TruvernQuestionnaireProjectionMetadata
  | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const raw =
    metadata[
      TRUVERN_QUESTIONNAIRE_PROJECTION_METADATA_KEY
    ];

  if (!isRecord(raw)) {
    return null;
  }

  const profileId =
    nonEmptyString(raw.profileId);

  const profileVersion =
    nonEmptyString(raw.profileVersion);

  const interactionId =
    nonEmptyString(raw.interactionId);

  const componentId =
    nonEmptyString(raw.componentId);

  if (
    !profileId ||
    !profileVersion ||
    !interactionId ||
    !componentId ||
    !isTruvernApplicabilityState(
      raw.applicability,
    )
  ) {
    return null;
  }

  return {
    profileId,
    profileVersion,
    interactionId,
    componentId,
    applicability:
      raw.applicability,
    notApplicableJustification:
      nonEmptyString(
        raw.notApplicableJustification,
      ),
    notApplicableReviewerAccepted:
      raw.notApplicableReviewerAccepted ===
      true,
  };
}

export function submissionCompletenessForResponse(
  response: {
    answer: unknown;
    metadata: unknown;
  },
): TruvernSubmissionCompleteness {
  const projection =
    readTruvernApplicability(
      response.metadata,
    );

  /*
   * Existing assessments without projection metadata
   * retain the legacy answer-required behavior.
   */
  if (!projection) {
    return hasAnswer(response.answer)
      ? {
          complete: true,
          reason: null,
        }
      : {
          complete: false,
          reason: "ANSWER_REQUIRED",
        };
  }

  if (
    projection.applicability ===
    "UNRESOLVED"
  ) {
    return {
      complete: false,
      reason:
        "UNRESOLVED_APPLICABILITY",
    };
  }

  if (
    projection.applicability ===
    "NOT_APPLICABLE"
  ) {
    if (
      !projection
        .notApplicableJustification
    ) {
      return {
        complete: false,
        reason:
          "NOT_APPLICABLE_JUSTIFICATION_REQUIRED",
      };
    }

    /*
     * Reviewer acceptance is deliberately not controlled
     * by the vendor and does not prevent the vendor from
     * submitting the questionnaire for governance review.
     */
    return {
      complete: true,
      reason: null,
    };
  }

  return hasAnswer(response.answer)
    ? {
        complete: true,
        reason: null,
      }
    : {
        complete: false,
        reason: "ANSWER_REQUIRED",
      };
}
