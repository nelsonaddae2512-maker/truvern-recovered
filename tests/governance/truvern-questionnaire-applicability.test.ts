import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mergeVendorApplicabilityMetadata,
  parseVendorApplicabilityInput,
  readTruvernApplicability,
  submissionCompletenessForResponse,
} from "@/lib/governance/questionnaires/truvern-questionnaire-applicability";

const baseInput = {
  profileId:
    "truvern-nist-800-53-vendor-213",
  profileVersion: "1.0.0",
  interactionId: "interaction-1",
  componentId: "component-1",
};

describe(
  "Truvern questionnaire applicability",
  () => {
    it(
      "preserves legacy answer-required behavior",
      () => {
        expect(
          submissionCompletenessForResponse({
            answer: null,
            metadata: null,
          }),
        ).toEqual({
          complete: false,
          reason: "ANSWER_REQUIRED",
        });

        expect(
          submissionCompletenessForResponse({
            answer: "yes",
            metadata: null,
          }),
        ).toEqual({
          complete: true,
          reason: null,
        });
      },
    );

    it(
      "requires an answer for APPLICABLE",
      () => {
        const metadata =
          mergeVendorApplicabilityMetadata(
            null,
            {
              ...baseInput,
              applicability:
                "APPLICABLE",
            },
          );

        expect(
          submissionCompletenessForResponse({
            answer: null,
            metadata,
          }).complete,
        ).toBe(false);

        expect(
          submissionCompletenessForResponse({
            answer: "yes",
            metadata,
          }).complete,
        ).toBe(true);
      },
    );

    it(
      "allows justified NOT_APPLICABLE without an answer",
      () => {
        const parsed =
          parseVendorApplicabilityInput({
            ...baseInput,
            applicability:
              "NOT_APPLICABLE",
            notApplicableJustification:
              "The service does not use this capability.",
          });

        expect(parsed.ok).toBe(true);

        if (!parsed.ok) {
          throw new Error(parsed.error);
        }

        const metadata =
          mergeVendorApplicabilityMetadata(
            null,
            parsed.value,
          );

        expect(
          submissionCompletenessForResponse({
            answer: null,
            metadata,
          }),
        ).toEqual({
          complete: true,
          reason: null,
        });
      },
    );

    it(
      "rejects NOT_APPLICABLE without justification",
      () => {
        const parsed =
          parseVendorApplicabilityInput({
            ...baseInput,
            applicability:
              "NOT_APPLICABLE",
            notApplicableJustification:
              " ",
          });

        expect(parsed.ok).toBe(false);
      },
    );

    it(
      "blocks UNRESOLVED even when an answer exists",
      () => {
        const metadata =
          mergeVendorApplicabilityMetadata(
            null,
            {
              ...baseInput,
              applicability:
                "UNRESOLVED",
            },
          );

        expect(
          submissionCompletenessForResponse({
            answer: "yes",
            metadata,
          }),
        ).toEqual({
          complete: false,
          reason:
            "UNRESOLVED_APPLICABILITY",
        });
      },
    );

    it(
      "rejects vendor control of reviewer acceptance",
      () => {
        const parsed =
          parseVendorApplicabilityInput({
            ...baseInput,
            applicability:
              "NOT_APPLICABLE",
            notApplicableJustification:
              "Not used.",
            notApplicableReviewerAccepted:
              true,
          });

        expect(parsed.ok).toBe(false);
      },
    );

    it(
      "preserves unrelated metadata but resets reviewer acceptance",
      () => {
        const metadata =
          mergeVendorApplicabilityMetadata(
            {
              otherField: "preserve-me",
              truvernQuestionnaireProjection:
                {
                  ...baseInput,
                  applicability:
                    "NOT_APPLICABLE",
                  notApplicableJustification:
                    "Earlier reason.",
                  notApplicableReviewerAccepted:
                    true,
                },
            },
            {
              ...baseInput,
              applicability:
                "NOT_APPLICABLE",
              notApplicableJustification:
                "Updated reason.",
            },
          ) as unknown as Record<
            string,
            unknown
          >;

        expect(
          metadata.otherField,
        ).toBe("preserve-me");

        const projection =
          readTruvernApplicability(
            metadata,
          );

        expect(
          projection
            ?.notApplicableReviewerAccepted,
        ).toBe(false);

        expect(
          projection
            ?.notApplicableJustification,
        ).toBe("Updated reason.");
      },
    );
  },
);
