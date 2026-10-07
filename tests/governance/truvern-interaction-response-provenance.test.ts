import { describe, expect, it } from "vitest";
import {
  mergeTruvernVendorInteractionResponseProvenance,
  readTruvernVendorInteractionResponseProvenance,
  TRUVERN_VENDOR_INTERACTION_RESPONSE_METADATA_KEY,
} from "@/lib/governance/questionnaires/truvern-interaction-response-provenance";

describe(
  "Truvern vendor interaction response provenance",
  () => {
    it(
      "preserves existing metadata while adding provenance",
      () => {
        const existing = {
          truvernQuestionnaireProjection: {
            profileId:
              "truvern-nist-800-53-vendor-213",
            profileVersion: "1.0.0",
            interactionId: "TRV-Q7R1-001",
            componentId: "TRV-Q7R1-001-C01",
            applicability: "APPLICABLE",
            notApplicableJustification: null,
            notApplicableReviewerAccepted: false,
          },
          unrelated: {
            preserveMe: true,
          },
        };

        const merged =
          mergeTruvernVendorInteractionResponseProvenance(
            existing,
            {
              interactionId: "TRV-Q7R1-001",
              componentId: "TRV-Q7R1-001-C01",
              mode: "CONFIRMED",
              sharedAnswer: "no",
              confirmedAt:
                "2026-10-07T00:00:00.000Z",
            },
          ) as Record<string, unknown>;

        expect(
          merged.truvernQuestionnaireProjection,
        ).toEqual(
          existing.truvernQuestionnaireProjection,
        );

        expect(merged.unrelated).toEqual({
          preserveMe: true,
        });

        expect(
          merged[
            TRUVERN_VENDOR_INTERACTION_RESPONSE_METADATA_KEY
          ],
        ).toEqual({
          version: 1,
          interactionId: "TRV-Q7R1-001",
          componentId: "TRV-Q7R1-001-C01",
          mode: "CONFIRMED",
          sharedAnswer: "no",
          confirmedAt:
            "2026-10-07T00:00:00.000Z",
        });
      },
    );

    it(
      "reads valid provenance and rejects malformed provenance",
      () => {
        const valid =
          readTruvernVendorInteractionResponseProvenance({
            [TRUVERN_VENDOR_INTERACTION_RESPONSE_METADATA_KEY]:
              {
                version: 1,
                interactionId: "TRV-Q7R1-001",
                componentId: "TRV-Q7R1-001-C01",
                mode: "OVERRIDE",
                sharedAnswer: "yes",
                confirmedAt:
                  "2026-10-07T00:00:00.000Z",
              },
          });

        expect(valid?.mode).toBe("OVERRIDE");

        expect(
          readTruvernVendorInteractionResponseProvenance({
            [TRUVERN_VENDOR_INTERACTION_RESPONSE_METADATA_KEY]:
              {
                version: 1,
                interactionId: "",
                componentId: "TRV-Q7R1-001-C01",
                mode: "CONFIRMED",
                confirmedAt:
                  "2026-10-07T00:00:00.000Z",
              },
          }),
        ).toBeNull();
      },
    );
  },
);
