import {
  describe,
  expect,
  it,
} from "vitest";

import manifestJson from
  "@/lib/governance/questionnaires/truvern-nist-800-53-vendor-213.json";

import {
  TRUVERN_CANONICAL_QUESTION_COUNT,
  TRUVERN_VENDOR_INTERACTION_COUNT,
  getTruvernVendorQuestionnaireComponentByQuestionId,
  getTruvernVendorQuestionnaireInteraction,
  truvernVendorQuestionnaireProjection,
  validateTruvernQuestionnaireProjectionManifest,
} from "@/lib/governance/questionnaires/truvern-questionnaire-projection";

function cloneManifest(): unknown {
  return JSON.parse(
    JSON.stringify(manifestJson),
  ) as unknown;
}

describe(
  "Truvern vendor questionnaire projection",
  () => {
    it(
      "loads the certified 213 interaction profile",
      () => {
        expect(
          truvernVendorQuestionnaireProjection
            .interactionCount,
        ).toBe(
          TRUVERN_VENDOR_INTERACTION_COUNT,
        );

        expect(
          truvernVendorQuestionnaireProjection
            .canonicalQuestionCount,
        ).toBe(
          TRUVERN_CANONICAL_QUESTION_COUNT,
        );

        expect(
          truvernVendorQuestionnaireProjection
            .interactions,
        ).toHaveLength(213);
      },
    );

    it(
      "maps all 301 canonical questions exactly once",
      () => {
        const questionIds =
          truvernVendorQuestionnaireProjection
            .interactions
            .flatMap(
              (interaction) =>
                interaction.components.map(
                  (component) =>
                    component.canonicalQuestionId,
                ),
            );

        expect(questionIds).toHaveLength(301);

        expect(
          new Set(questionIds).size,
        ).toBe(301);

        expect(
          [...questionIds].sort(
            (left, right) => left - right,
          ),
        ).toEqual(
          Array.from(
            { length: 301 },
            (_, index) => index + 1,
          ),
        );
      },
    );

    it(
      "keeps N/A and unresolved applicability fail closed",
      () => {
        for (
          const interaction of
            truvernVendorQuestionnaireProjection
              .interactions
        ) {
          for (
            const component of interaction.components
          ) {
            expect(
              component.applicability
                .notApplicableRequiresJustification,
            ).toBe(true);

            expect(
              component.applicability
                .notApplicableRequiresReviewerAcceptance,
            ).toBe(true);

            expect(
              component.applicability
                .unresolvedBlocksSubmission,
            ).toBe(true);

            expect(
              component.applicability
                .notApplicableIsAnswer,
            ).toBe(false);
          }
        }
      },
    );

    it(
      "resolves every canonical question through the projection index",
      () => {
        for (
          let questionId = 1;
          questionId <= 301;
          questionId += 1
        ) {
          const resolved =
            getTruvernVendorQuestionnaireComponentByQuestionId(
              questionId,
            );

          expect(resolved).not.toBeNull();

          expect(
            resolved?.component
              .canonicalQuestionId,
          ).toBe(questionId);
        }
      },
    );

    it(
      "resolves every interaction by its certified identifier",
      () => {
        for (
          const interaction of
            truvernVendorQuestionnaireProjection
              .interactions
        ) {
          expect(
            getTruvernVendorQuestionnaireInteraction(
              interaction.interactionId,
            ),
          ).toBe(interaction);
        }
      },
    );

    it(
      "fails closed on profile drift",
      () => {
        const candidate =
          cloneManifest() as {
            profileVersion: string;
          };

        candidate.profileVersion =
          "unexpected-version";

        expect(
          () =>
            validateTruvernQuestionnaireProjectionManifest(
              candidate,
            ),
        ).toThrow(
          /unexpected profileVersion/,
        );
      },
    );

    it(
      "fails closed on duplicate canonical mappings",
      () => {
        const candidate =
          cloneManifest() as {
            interactions: Array<{
              components: Array<{
                canonicalQuestionId: number;
              }>;
            }>;
          };

        const first =
          candidate.interactions[0]
            .components[0];

        const second =
          candidate.interactions[1]
            .components[0];

        second.canonicalQuestionId =
          first.canonicalQuestionId;

        expect(
          () =>
            validateTruvernQuestionnaireProjectionManifest(
              candidate,
            ),
        ).toThrow(
          /duplicate canonicalQuestionId/,
        );
      },
    );

    it(
      "fails closed when N/A is converted into an answer",
      () => {
        const candidate =
          cloneManifest() as {
            interactions: Array<{
              components: Array<{
                applicability: {
                  notApplicableIsAnswer: boolean;
                };
              }>;
            }>;
          };

        candidate.interactions[0]
          .components[0]
          .applicability
          .notApplicableIsAnswer = true;

        expect(
          () =>
            validateTruvernQuestionnaireProjectionManifest(
              candidate,
            ),
        ).toThrow(
          /N\/A must not be an answer/,
        );
      },
    );

    it(
      "fails closed when unresolved applicability stops blocking submission",
      () => {
        const candidate =
          cloneManifest() as {
            interactions: Array<{
              components: Array<{
                applicability: {
                  unresolvedBlocksSubmission:
                    boolean;
                };
              }>;
            }>;
          };

        candidate.interactions[0]
          .components[0]
          .applicability
          .unresolvedBlocksSubmission = false;

        expect(
          () =>
            validateTruvernQuestionnaireProjectionManifest(
              candidate,
            ),
        ).toThrow(
          /unresolved applicability must block submission/,
        );
      },
    );

    it(
      "fails closed on interaction count drift",
      () => {
        const candidate =
          cloneManifest() as {
            interactionCount: number;
          };

        candidate.interactionCount = 212;

        expect(
          () =>
            validateTruvernQuestionnaireProjectionManifest(
              candidate,
            ),
        ).toThrow(
          /interactionCount must equal 213/,
        );
      },
    );
  },
);
