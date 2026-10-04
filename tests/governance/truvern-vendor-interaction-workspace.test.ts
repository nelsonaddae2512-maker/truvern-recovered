import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";
import {
  truvernVendorQuestionnaireProjection,
} from "@/lib/governance/questionnaires/truvern-questionnaire-projection";

const pageSource =
  readFileSync(
    "app/vendor-framework-assessment/[token]/page.tsx",
    "utf8",
  );

const workspaceSource =
  readFileSync(
    "components/vendor-assessment/vendor-framework-assessment-workspace.client.tsx",
    "utf8",
  );

const interactionCardSource =
  readFileSync(
    "components/vendor-assessment/vendor-framework-interaction-card.client.tsx",
    "utf8",
  );

const legacyQuestionCardSource =
  readFileSync(
    "components/vendor-assessment/question-card.tsx",
    "utf8",
  );

describe(
  "Truvern 213-interaction vendor workspace",
  () => {
    it(
      "uses exactly 213 certified interactions",
      () => {
        expect(
          truvernVendorQuestionnaireProjection
            .interactions,
        ).toHaveLength(213);
      },
    );

    it(
      "still projects exactly 301 canonical components",
      () => {
        const components =
          truvernVendorQuestionnaireProjection
            .interactions
            .flatMap(
              (interaction) =>
                interaction.components,
            );

        expect(
          components,
        ).toHaveLength(301);

        expect(
          new Set(
            components.map(
              (component) =>
                component
                  .canonicalQuestionId,
            ),
          ).size,
        ).toBe(301);
      },
    );

    it(
      "projects the certified manifest on the server page",
      () => {
        expect(
          pageSource,
        ).toContain(
          "truvernVendorQuestionnaireProjection",
        );

        expect(
          pageSource,
        ).toContain(
          "interactions={vendorQuestionnaire.interactions}",
        );
      },
    );

    it(
      "renders interactions rather than canonical question cards",
      () => {
        expect(
          workspaceSource,
        ).toContain(
          "VendorFrameworkInteractionCard",
        );

        expect(
          workspaceSource,
        ).toContain(
          "interactions.map(",
        );

        expect(
          workspaceSource,
        ).not.toContain(
          "VendorAssessmentQuestionCard",
        );
      },
    );

    it(
      "keeps canonical response IDs as the persistence target",
      () => {
        expect(
          interactionCardSource,
        ).toContain(
          "responseId: response.id",
        );

        expect(
          interactionCardSource,
        ).toContain(
          "canonicalQuestionId",
        );
      },
    );

    it(
      "sends certified applicability identity",
      () => {
        for (const value of [
          "profileId",
          "profileVersion",
          "interactionId",
          "componentId",
          "applicability",
          "notApplicableJustification",
        ]) {
          expect(
            interactionCardSource,
          ).toContain(value);
        }
      },
    );

    it(
      "does not encode N/A as an answer option",
      () => {
        expect(
          interactionCardSource,
        ).toContain(
          '"NOT_APPLICABLE"',
        );

        expect(
          interactionCardSource,
        ).not.toContain(
          'value="not_applicable"',
        );
      },
    );

    it(
      "preserves canonical evidence attachment",
      () => {
        expect(
          interactionCardSource,
        ).toContain(
          "responseId={response.id}",
        );

        expect(
          interactionCardSource,
        ).toContain(
          "EvidenceUpload",
        );
      },
    );

    it(
      "keeps interaction progress separate from canonical coverage",
      () => {
        expect(
          workspaceSource,
        ).toContain(
          "completedInteractions",
        );

        expect(
          workspaceSource,
        ).toContain(
          "completedComponents",
        );

        expect(
          workspaceSource,
        ).toContain(
          "Canonical coverage",
        );
      },
    );

    it(
      "does not mutate the shared legacy question-card contract",
      () => {
        expect(
          legacyQuestionCardSource,
        ).toContain(
          "VendorAssessmentQuestionCard",
        );

        expect(
          legacyQuestionCardSource,
        ).toContain(
          "/api/vendor-assessments/",
        );
      },
    );
  },
);