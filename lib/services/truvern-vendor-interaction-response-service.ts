import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  getTruvernVendorQuestionnaireInteraction,
  truvernVendorQuestionnaireProjection,
} from "@/lib/governance/questionnaires/truvern-questionnaire-projection";
import {
  mergeTruvernVendorInteractionResponseProvenance,
  type TruvernVendorInteractionResponseMode,
} from "@/lib/governance/questionnaires/truvern-interaction-response-provenance";
import {
  findFirstTruvernAssessmentResponse,
  updateTruvernAssessmentResponse,
} from "@/lib/repositories/truvern-assessment-response-repository";

export type TruvernInteractionComponentWrite = {
  responseId: number;
  questionId: number;
  componentId: string;
  mode: TruvernVendorInteractionResponseMode;
  answer: Prisma.InputJsonValue | typeof Prisma.JsonNull;
};

export type ApplyTruvernVendorInteractionResponseInput = {
  assessmentId: number;
  interactionId: string;
  sharedAnswer: unknown;
  confirmedAt: string;
  components: TruvernInteractionComponentWrite[];
};

export async function applyTruvernVendorInteractionResponse(
  input: ApplyTruvernVendorInteractionResponseInput,
) {
  const interaction =
    getTruvernVendorQuestionnaireInteraction(
      input.interactionId,
    );

  if (!interaction) {
    throw new Error(
      "Interaction is not present in the certified questionnaire projection.",
    );
  }

  if (input.components.length === 0) {
    throw new Error(
      "At least one canonical component must be supplied.",
    );
  }

  const certifiedByQuestionId =
    new Map(
      interaction.components.map(
        (component) => [
          component.canonicalQuestionId,
          component,
        ],
      ),
    );

  const seenResponseIds =
    new Set<number>();

  const seenQuestionIds =
    new Set<number>();

  for (const write of input.components) {
    if (
      seenResponseIds.has(write.responseId) ||
      seenQuestionIds.has(write.questionId)
    ) {
      throw new Error(
        "Duplicate canonical response write requested.",
      );
    }

    seenResponseIds.add(write.responseId);
    seenQuestionIds.add(write.questionId);

    const certified =
      certifiedByQuestionId.get(write.questionId);

    if (
      !certified ||
      certified.componentId !== write.componentId
    ) {
      throw new Error(
        "Interaction component does not match the certified questionnaire projection.",
      );
    }
  }

  return prisma.$transaction(
    async (tx) => {
      const canonicalRows = [];

      /*
       * Phase 1:
       * Resolve every response from authoritative persistence.
       * No canonical update is allowed until every requested
       * responseId + assessmentId + questionId association has
       * been proven.
       */
      for (const write of input.components) {
        const canonical =
          await findFirstTruvernAssessmentResponse(
            {
              where: {
                id: write.responseId,
                assessmentId:
                  input.assessmentId,
                questionId:
                  write.questionId,
              },
              select: {
                id: true,
                assessmentId: true,
                questionId: true,
                metadata: true,
              },
            },
            tx,
          );

        if (!canonical) {
          throw new Error(
            "Canonical response does not belong to the assessment and question supplied.",
          );
        }

        canonicalRows.push({
          write,
          canonical,
        });
      }

      /*
       * Phase 2:
       * All ownership checks passed.
       * Metadata now comes exclusively from the authoritative
       * canonical row loaded inside this transaction.
       */
      const updated = [];

      for (
        const {
          write,
          canonical,
        } of canonicalRows
      ) {
        const metadata =
          mergeTruvernVendorInteractionResponseProvenance(
            canonical.metadata,
            {
              interactionId:
                input.interactionId,
              componentId:
                write.componentId,
              mode:
                write.mode,
              sharedAnswer:
                input.sharedAnswer,
              confirmedAt:
                input.confirmedAt,
            },
          );

        const response =
          await updateTruvernAssessmentResponse(
            {
              where: {
                id: canonical.id,
                assessmentId:
                  canonical.assessmentId,
              },
              data: {
                answer:
                  write.answer,
                metadata,
              },
            },
            tx,
          );

        updated.push(response);
      }

      return {
        profileId:
          truvernVendorQuestionnaireProjection.profileId,
        profileVersion:
          truvernVendorQuestionnaireProjection.profileVersion,
        interactionId:
          input.interactionId,
        responses:
          updated,
      };
    },
  );
}
