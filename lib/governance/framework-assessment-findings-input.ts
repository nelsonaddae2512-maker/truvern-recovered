import type { TruvernScoringInput } from "@/lib/governance/scoring-engine";

function stringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string" &&
      item.trim().length > 0,
  );
}

function semanticQuestionMetadata(
  value: unknown,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<
    string,
    unknown
  >;
}

function normalizeEnhancements(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ): item is Record<
        string,
        unknown
      > =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item),
    )
    .map((item) => ({
      controlId:
        typeof item.controlId ===
        "string"
          ? item.controlId
          : null,

      title:
        typeof item.title ===
        "string"
          ? item.title
          : null,

      statementText:
        typeof item.statementText ===
        "string"
          ? item.statementText
          : null,

      parameterIds:
        stringArray(
          item.parameterIds,
        ),

      objectiveIds:
        stringArray(
          item.objectiveIds,
        ),

      methodIds:
        stringArray(
          item.methodIds,
        ),

      objectIds:
        stringArray(
          item.objectIds,
        ),

      methodTypes:
        stringArray(
          item.methodTypes,
        ),

      conditionalVendorFollowUp:
        item.conditionalVendorFollowUp ===
        true,

      followUpTrigger:
        typeof item.followUpTrigger ===
        "string"
          ? item.followUpTrigger
          : null,

      evidenceTrigger:
        typeof item.evidenceTrigger ===
        "string"
          ? item.evidenceTrigger
          : null,

      remediationTrigger:
        typeof item.remediationTrigger ===
        "string"
          ? item.remediationTrigger
          : null,

      attestationTrigger:
        typeof item.attestationTrigger ===
        "string"
          ? item.attestationTrigger
          : null,
    }));
}

export function normalizeFrameworkAssessmentFindingsInput(
  responses: any[],
): TruvernScoringInput[] {
  return responses.map(
    (response) => {
      const metadata =
        semanticQuestionMetadata(
          response.question.metadata,
        );

      return {
        questionId:
          response.questionId,

        controlId:
          response.question
            .control.id,

        controlCode:
          response.question
            .control.controlId,

        family:
          response.question
            .control.family,

        prompt:
          response.question.prompt,

        answer:
          response.answer,

        score:
          response.score,

        maxScore:
          response.question
            .weight ?? 1,

        weight:
          response.question
            .weight ?? 1,

        requiresEvidence:
          response.question
            .requiresEvidence,

        requiresAttestation:
          response.question
            .requiresAttestation,

        evidence:
          response.evidence,

        recommendedEvidence:
          metadata
            .recommendedEvidence ===
          true,

        parameterIds:
          stringArray(
            metadata.parameterIds,
          ),

        assessmentObjectiveIds:
          stringArray(
            metadata
              .assessmentObjectiveIds,
          ),

        assessmentMethodIds:
          stringArray(
            metadata
              .assessmentMethodIds,
          ),

        assessmentObjectIds:
          stringArray(
            metadata
              .assessmentObjectIds,
          ),

        methodTypes:
          stringArray(
            metadata.methodTypes,
          ),

        conditionalEnhancements:
          normalizeEnhancements(
            metadata
              .conditionalEnhancements,
          ),
      };
    },
  );
}
