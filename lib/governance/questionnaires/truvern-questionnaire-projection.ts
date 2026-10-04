import manifestJson from "./truvern-nist-800-53-vendor-213.json";

export const TRUVERN_VENDOR_QUESTIONNAIRE_PROFILE_ID =
  "truvern-nist-800-53-vendor-213" as const;

export const TRUVERN_VENDOR_QUESTIONNAIRE_PROFILE_VERSION =
  "1.0.0" as const;

export const TRUVERN_VENDOR_QUESTIONNAIRE_FRAMEWORK_SLUG =
  "nist-800-53-rev5" as const;

export const TRUVERN_VENDOR_QUESTIONNAIRE_FRAMEWORK_VERSION =
  "5.2.0" as const;

export const TRUVERN_VENDOR_INTERACTION_COUNT = 213 as const;

export const TRUVERN_CANONICAL_QUESTION_COUNT = 301 as const;

export type TruvernQuestionnaireApplicability = {
  mode: string;
  rule: string;
  notApplicableRequiresJustification: boolean;
  notApplicableRequiresReviewerAcceptance: boolean;
  unresolvedBlocksSubmission: boolean;
  notApplicableIsAnswer: boolean;
};

export type TruvernCanonicalSemantics = {
  prompt: string | null;
  helpText: string | null;
  evidencePrompt: string | null;
  weight: number | null;
  requiresEvidence: boolean | null;
  requiresAttestation: boolean | null;
  evidencePolicy: string | null;
  findingsPolicy: string | null;
  recommendedEvidence: boolean | null;
  methodTypes: unknown[];
  assessmentMethodIds: unknown[];
  assessmentObjectiveIds: unknown[];
  conditionalEnhancements: unknown[];
  questionnaireSha256: string | null;
  authoritativeSourceSha256: string | null;
  canonicalPersistenceSha256: string | null;
};

export type TruvernQuestionnaireComponent = {
  componentId: string;
  order: number;
  canonicalQuestionId: number;
  canonicalControlId: string;
  family: string;
  label: string;
  required: boolean;
  applicability: TruvernQuestionnaireApplicability;
  canonicalSemantics: TruvernCanonicalSemantics;
};

export type TruvernQuestionnaireInteraction = {
  interactionId: string;
  order: number;
  family: string;
  title: string;
  prompt: string;
  treatment: string;
  answerModel: string;
  applicabilityRule: string;
  evidenceExpectation: string;
  origin: string;
  rationale: string;
  componentCount: number;
  components: TruvernQuestionnaireComponent[];
};

export type TruvernProjectionPolicy = {
  storageInvariant: string;
  interactionInvariant: string;
  componentWritePolicy: string;
  evidenceReusePolicy: string;
  notApplicablePolicy: string;
  unknownPolicy: string;
  submissionPolicy: string;
  scoringPolicy: string;
};

export type TruvernQuestionnaireProjectionManifest = {
  schema: string;
  schemaVersion: string;
  profileId: string;
  profileVersion: string;
  status: string;
  frameworkSlug: string;
  frameworkName: string;
  frameworkVersion: string;
  interactionCount: number;
  canonicalQuestionCount: number;
  projectionPolicy: TruvernProjectionPolicy;
  interactions: TruvernQuestionnaireInteraction[];
};

function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      `Invalid Truvern questionnaire projection manifest: ${message}`,
    );
  }
}

function requireNonEmptyString(
  value: unknown,
  field: string,
): asserts value is string {
  invariant(
    typeof value === "string" &&
      value.trim().length > 0,
    `${field} must be a non-empty string`,
  );
}

function requireBoolean(
  value: unknown,
  field: string,
): asserts value is boolean {
  invariant(
    typeof value === "boolean",
    `${field} must be boolean`,
  );
}

function requirePositiveInteger(
  value: unknown,
  field: string,
): asserts value is number {
  invariant(
    Number.isInteger(value) &&
      Number(value) > 0,
    `${field} must be a positive integer`,
  );
}

export function validateTruvernQuestionnaireProjectionManifest(
  input: unknown,
): TruvernQuestionnaireProjectionManifest {
  invariant(
    typeof input === "object" &&
      input !== null &&
      !Array.isArray(input),
    "root must be an object",
  );

  const manifest =
    input as Partial<TruvernQuestionnaireProjectionManifest>;

  invariant(
    manifest.schema ===
      "TRUVERN_QUESTIONNAIRE_PROJECTION_MANIFEST",
    "unexpected schema",
  );

  invariant(
    manifest.schemaVersion === "1.0.0",
    "unexpected schemaVersion",
  );

  invariant(
    manifest.profileId ===
      TRUVERN_VENDOR_QUESTIONNAIRE_PROFILE_ID,
    "unexpected profileId",
  );

  invariant(
    manifest.profileVersion ===
      TRUVERN_VENDOR_QUESTIONNAIRE_PROFILE_VERSION,
    "unexpected profileVersion",
  );

  invariant(
    manifest.frameworkSlug ===
      TRUVERN_VENDOR_QUESTIONNAIRE_FRAMEWORK_SLUG,
    "unexpected frameworkSlug",
  );

  invariant(
    manifest.frameworkVersion ===
      TRUVERN_VENDOR_QUESTIONNAIRE_FRAMEWORK_VERSION,
    "unexpected frameworkVersion",
  );

  invariant(
    manifest.interactionCount ===
      TRUVERN_VENDOR_INTERACTION_COUNT,
    "interactionCount must equal 213",
  );

  invariant(
    manifest.canonicalQuestionCount ===
      TRUVERN_CANONICAL_QUESTION_COUNT,
    "canonicalQuestionCount must equal 301",
  );

  invariant(
    Array.isArray(manifest.interactions),
    "interactions must be an array",
  );

  invariant(
    manifest.interactions.length ===
      TRUVERN_VENDOR_INTERACTION_COUNT,
    "interactions array must contain 213 entries",
  );

  invariant(
    typeof manifest.projectionPolicy === "object" &&
      manifest.projectionPolicy !== null,
    "projectionPolicy must be an object",
  );

  const policy =
    manifest.projectionPolicy as Partial<TruvernProjectionPolicy>;

  const policyFields:
    Array<keyof TruvernProjectionPolicy> = [
      "storageInvariant",
      "interactionInvariant",
      "componentWritePolicy",
      "evidenceReusePolicy",
      "notApplicablePolicy",
      "unknownPolicy",
      "submissionPolicy",
      "scoringPolicy",
    ];

  for (const field of policyFields) {
    requireNonEmptyString(
      policy[field],
      `projectionPolicy.${field}`,
    );
  }

  const notApplicablePolicy =
    policy.notApplicablePolicy;

  const unknownPolicy =
    policy.unknownPolicy;

  const scoringPolicy =
    policy.scoringPolicy;

  requireNonEmptyString(
    notApplicablePolicy,
    "projectionPolicy.notApplicablePolicy",
  );

  requireNonEmptyString(
    unknownPolicy,
    "projectionPolicy.unknownPolicy",
  );

  requireNonEmptyString(
    scoringPolicy,
    "projectionPolicy.scoringPolicy",
  );

  invariant(
    notApplicablePolicy.includes(
      "not a scored answer",
    ),
    "N/A must remain outside scored answers",
  );

  invariant(
    unknownPolicy.includes(
      "never be treated as affirmative",
    ),
    "UNKNOWN must not be affirmative",
  );

  invariant(
    scoringPolicy.includes(
      "N/A score of 50",
    ),
    "legacy N/A=50 scoring guard is missing",
  );

  const interactionIds = new Set<string>();
  const componentIds = new Set<string>();
  const canonicalQuestionIds = new Set<number>();

  let componentCount = 0;

  for (
    let interactionIndex = 0;
    interactionIndex < manifest.interactions.length;
    interactionIndex += 1
  ) {
    const interaction =
      manifest.interactions[interactionIndex];

    invariant(
      typeof interaction === "object" &&
        interaction !== null,
      `interaction ${interactionIndex} must be an object`,
    );

    requireNonEmptyString(
      interaction.interactionId,
      `interaction ${interactionIndex}.interactionId`,
    );

    invariant(
      !interactionIds.has(interaction.interactionId),
      `duplicate interactionId ${interaction.interactionId}`,
    );

    interactionIds.add(interaction.interactionId);

    requirePositiveInteger(
      interaction.order,
      `${interaction.interactionId}.order`,
    );

    requireNonEmptyString(
      interaction.family,
      `${interaction.interactionId}.family`,
    );

    requireNonEmptyString(
      interaction.prompt,
      `${interaction.interactionId}.prompt`,
    );

    invariant(
      Array.isArray(interaction.components),
      `${interaction.interactionId}.components must be an array`,
    );

    invariant(
      interaction.components.length > 0,
      `${interaction.interactionId} must contain components`,
    );

    invariant(
      interaction.componentCount ===
        interaction.components.length,
      `${interaction.interactionId} componentCount mismatch`,
    );

    for (
      let componentIndex = 0;
      componentIndex < interaction.components.length;
      componentIndex += 1
    ) {
      const component =
        interaction.components[componentIndex];

      invariant(
        typeof component === "object" &&
          component !== null,
        `${interaction.interactionId} component ${componentIndex} must be an object`,
      );

      requireNonEmptyString(
        component.componentId,
        `${interaction.interactionId}.componentId`,
      );

      invariant(
        !componentIds.has(component.componentId),
        `duplicate componentId ${component.componentId}`,
      );

      componentIds.add(component.componentId);

      requirePositiveInteger(
        component.order,
        `${component.componentId}.order`,
      );

      requirePositiveInteger(
        component.canonicalQuestionId,
        `${component.componentId}.canonicalQuestionId`,
      );

      invariant(
        component.canonicalQuestionId <=
          TRUVERN_CANONICAL_QUESTION_COUNT,
        `${component.componentId} canonicalQuestionId exceeds 301`,
      );

      invariant(
        !canonicalQuestionIds.has(
          component.canonicalQuestionId,
        ),
        `duplicate canonicalQuestionId ${component.canonicalQuestionId}`,
      );

      canonicalQuestionIds.add(
        component.canonicalQuestionId,
      );

      requireNonEmptyString(
        component.canonicalControlId,
        `${component.componentId}.canonicalControlId`,
      );

      requireNonEmptyString(
        component.family,
        `${component.componentId}.family`,
      );

      requireBoolean(
        component.required,
        `${component.componentId}.required`,
      );

      invariant(
        component.required === true,
        `${component.componentId} must remain required`,
      );

      invariant(
        typeof component.applicability === "object" &&
          component.applicability !== null,
        `${component.componentId}.applicability must be an object`,
      );

      requireBoolean(
        component.applicability
          .notApplicableRequiresJustification,
        `${component.componentId}.notApplicableRequiresJustification`,
      );

      requireBoolean(
        component.applicability
          .notApplicableRequiresReviewerAcceptance,
        `${component.componentId}.notApplicableRequiresReviewerAcceptance`,
      );

      requireBoolean(
        component.applicability
          .unresolvedBlocksSubmission,
        `${component.componentId}.unresolvedBlocksSubmission`,
      );

      requireBoolean(
        component.applicability
          .notApplicableIsAnswer,
        `${component.componentId}.notApplicableIsAnswer`,
      );

      invariant(
        component.applicability
          .notApplicableRequiresJustification === true,
        `${component.componentId} must require N/A justification`,
      );

      invariant(
        component.applicability
          .notApplicableRequiresReviewerAcceptance === true,
        `${component.componentId} must require N/A reviewer acceptance`,
      );

      invariant(
        component.applicability
          .unresolvedBlocksSubmission === true,
        `${component.componentId} unresolved applicability must block submission`,
      );

      invariant(
        component.applicability
          .notApplicableIsAnswer === false,
        `${component.componentId} N/A must not be an answer`,
      );

      componentCount += 1;
    }
  }

  invariant(
    componentCount ===
      TRUVERN_CANONICAL_QUESTION_COUNT,
    "manifest must contain exactly 301 component mappings",
  );

  invariant(
    canonicalQuestionIds.size ===
      TRUVERN_CANONICAL_QUESTION_COUNT,
    "canonical question IDs must be unique",
  );

  for (
    let questionId = 1;
    questionId <= TRUVERN_CANONICAL_QUESTION_COUNT;
    questionId += 1
  ) {
    invariant(
      canonicalQuestionIds.has(questionId),
      `missing canonicalQuestionId ${questionId}`,
    );
  }

  return manifest as TruvernQuestionnaireProjectionManifest;
}

export const truvernVendorQuestionnaireProjection =
  validateTruvernQuestionnaireProjectionManifest(
    manifestJson,
  );

export function getTruvernVendorQuestionnaireInteraction(
  interactionId: string,
): TruvernQuestionnaireInteraction | null {
  return (
    truvernVendorQuestionnaireProjection.interactions.find(
      (interaction) =>
        interaction.interactionId === interactionId,
    ) ?? null
  );
}

export function getTruvernVendorQuestionnaireComponentByQuestionId(
  canonicalQuestionId: number,
): {
  interaction: TruvernQuestionnaireInteraction;
  component: TruvernQuestionnaireComponent;
} | null {
  for (
    const interaction of
      truvernVendorQuestionnaireProjection.interactions
  ) {
    const component =
      interaction.components.find(
        (candidate) =>
          candidate.canonicalQuestionId ===
          canonicalQuestionId,
      );

    if (component) {
      return {
        interaction,
        component,
      };
    }
  }

  return null;
}
