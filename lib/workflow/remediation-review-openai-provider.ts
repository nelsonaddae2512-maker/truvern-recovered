import "server-only";

import type {
  RemediationReviewInput,
  RemediationReviewResult,
} from "@/lib/workflow/remediation-review-contract";

export const OPENAI_REMEDIATION_REVIEW_PROVIDER_VERSION =
  "TRV-OPENAI-REMEDIATION-REVIEW-1.0" as const;

export const DEFAULT_OPENAI_REMEDIATION_REVIEW_MODEL =
  "gpt-5.6-terra" as const;

export const OPENAI_REMEDIATION_REVIEW_ENDPOINT =
  "https://api.openai.com/v1/responses" as const;

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_TIMEOUT_MS = 120_000;

/*
 * This is an OUTPUT ceiling, not a spending authorization.
 *
 * The worker remains unwired during this patch and therefore this
 * module cannot generate billable usage until a later certified
 * integration explicitly invokes it.
 */
export const OPENAI_REMEDIATION_REVIEW_MAX_OUTPUT_TOKENS =
  2_000 as const;

/*
 * Defense in depth.
 *
 * Provider safety must not depend on the worker preserving
 * its own evidence-text ceiling. Any current or future caller
 * receives the same bound before evidence text enters the
 * provider request body.
 */
export const OPENAI_REMEDIATION_REVIEW_MAX_EVIDENCE_TEXT_CHARS =
  65_536 as const;

/*
 * Hard ceiling for the complete serialized remediation-review
 * provider input. This is measured in UTF-8 bytes.
 *
 * It is an input-size safety boundary, not a token estimate
 * and not a dollar-spend guarantee.
 */
export const OPENAI_REMEDIATION_REVIEW_MAX_INPUT_UTF8_BYTES =
  131_072 as const;

export type OpenAiRemediationReviewConfig = {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
};

export type OpenAiRemediationReviewResponse = {
  result: RemediationReviewResult;
  providerRequestId: string | null;
  model: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
};

type UnknownRecord = Record<string, unknown>;

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function requireNonEmptyString(
  value: string,
  label: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeTimeoutMs(
  value: number | undefined,
): number {
  if (value == null) {
    return DEFAULT_TIMEOUT_MS;
  }

  if (
    !Number.isInteger(value) ||
    value <= 0 ||
    value > MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `OpenAI remediation review timeout must be an integer between 1 and ${MAX_TIMEOUT_MS} milliseconds.`,
    );
  }

  return value;
}

function nullableInteger(
  value: unknown,
): number | null {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
  )
    ? value
    : null;
}

function requireStringArray(
  value: unknown,
  label: string,
): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new Error(
      `OpenAI remediation review ${label} must be a string array.`,
    );
  }

  return value;
}

function parseRecommendation(
  value: unknown,
): RemediationReviewResult["recommendation"] {
  switch (value) {
    case "REMEDIATION_APPEARS_SUFFICIENT":
    case "MORE_INFORMATION_NEEDED":
    case "REMEDIATION_APPEARS_INSUFFICIENT":
    case "HUMAN_REVIEW_REQUIRED":
      return value;
    default:
      throw new Error(
        "OpenAI remediation review returned an invalid recommendation.",
      );
  }
}

function parseEvidenceSufficiency(
  value: unknown,
): RemediationReviewResult["evidenceSufficiency"] {
  switch (value) {
    case "SUFFICIENT":
    case "PARTIAL":
    case "INSUFFICIENT":
    case "NOT_ASSESSABLE":
      return value;
    default:
      throw new Error(
        "OpenAI remediation review returned invalid evidence sufficiency.",
      );
  }
}

function parseRequirementCoverage(
  value: unknown,
): RemediationReviewResult["requirementCoverage"] {
  switch (value) {
    case "COVERED":
    case "PARTIALLY_COVERED":
    case "NOT_COVERED":
    case "NOT_ASSESSABLE":
      return value;
    default:
      throw new Error(
        "OpenAI remediation review returned invalid requirement coverage.",
      );
  }
}

function parseReviewResult(
  value: unknown,
  contractVersion: RemediationReviewResult["contractVersion"],
): RemediationReviewResult {
  if (!isRecord(value)) {
    throw new Error(
      "OpenAI remediation review result must be an object.",
    );
  }

  if (value.contractVersion !== contractVersion) {
    throw new Error(
      "OpenAI remediation review contract version mismatch.",
    );
  }

  const confidence = value.confidence;

  if (
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error(
      "OpenAI remediation review confidence must be between 0 and 1.",
    );
  }

  if (
    typeof value.rationale !== "string" ||
    !value.rationale.trim()
  ) {
    throw new Error(
      "OpenAI remediation review rationale is required.",
    );
  }

  /*
   * This is a non-negotiable governance boundary.
   * AI may recommend. AI may never remove the human decision.
   */
  if (value.requiresHumanReview !== true) {
    throw new Error(
      "OpenAI remediation review must require human review.",
    );
  }

  return {
    contractVersion,
    recommendation:
      parseRecommendation(value.recommendation),
    confidence,
    evidenceSufficiency:
      parseEvidenceSufficiency(
        value.evidenceSufficiency,
      ),
    requirementCoverage:
      parseRequirementCoverage(
        value.requirementCoverage,
      ),
    identifiedGaps:
      requireStringArray(
        value.identifiedGaps,
        "identifiedGaps",
      ),
    residualConcerns:
      requireStringArray(
        value.residualConcerns,
        "residualConcerns",
      ),
    suggestedReviewerFocus:
      requireStringArray(
        value.suggestedReviewerFocus,
        "suggestedReviewerFocus",
      ),
    rationale:
      value.rationale.trim(),
    requiresHumanReview:
      true,
  };
}

const REMEDIATION_REVIEW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    contractVersion: {
      type: "string",
      enum: [
        "TRV-REMEDIATION-REVIEW-1.0",
      ],
    },
    recommendation: {
      type: "string",
      enum: [
        "REMEDIATION_APPEARS_SUFFICIENT",
        "MORE_INFORMATION_NEEDED",
        "REMEDIATION_APPEARS_INSUFFICIENT",
        "HUMAN_REVIEW_REQUIRED",
      ],
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    evidenceSufficiency: {
      type: "string",
      enum: [
        "SUFFICIENT",
        "PARTIAL",
        "INSUFFICIENT",
        "NOT_ASSESSABLE",
      ],
    },
    requirementCoverage: {
      type: "string",
      enum: [
        "COVERED",
        "PARTIALLY_COVERED",
        "NOT_COVERED",
        "NOT_ASSESSABLE",
      ],
    },
    identifiedGaps: {
      type: "array",
      items: {
        type: "string",
      },
    },
    residualConcerns: {
      type: "array",
      items: {
        type: "string",
      },
    },
    suggestedReviewerFocus: {
      type: "array",
      items: {
        type: "string",
      },
    },
    rationale: {
      type: "string",
    },
    requiresHumanReview: {
      type: "boolean",
      const: true,
    },
  },
  required: [
    "contractVersion",
    "recommendation",
    "confidence",
    "evidenceSufficiency",
    "requirementCoverage",
    "identifiedGaps",
    "residualConcerns",
    "suggestedReviewerFocus",
    "rationale",
    "requiresHumanReview",
  ],
} as const;

function buildSystemInstructions(): string {
  return [
    "You are Truvern's advisory remediation evidence reviewer.",
    "Evaluate whether the submitted remediation evidence addresses the stated governance gap and evidence requirements.",
    "Use only the supplied remediation and evidence context.",
    "Do not invent evidence, attestations, controls, certifications, or facts.",
    "If evidence is absent, unreadable, unsupported, ambiguous, stale, or insufficient, say so in the structured result.",
    "A recommendation of REMEDIATION_APPEARS_SUFFICIENT is advisory only and is never an approval.",
    "Human review is mandatory for every result.",
    "requiresHumanReview must always be true.",
    "Return only the structured response required by the supplied schema.",
  ].join("\n");
}

function boundProviderEvidenceText(
  text: string | null,
): string | null {
  if (text == null) {
    return null;
  }

  if (
    text.length <=
    OPENAI_REMEDIATION_REVIEW_MAX_EVIDENCE_TEXT_CHARS
  ) {
    return text;
  }

  return text.slice(
    0,
    OPENAI_REMEDIATION_REVIEW_MAX_EVIDENCE_TEXT_CHARS,
  );
}

function buildReviewInput(
  input: RemediationReviewInput,
): string {
  const evidenceText =
    boundProviderEvidenceText(
      input.evidenceContext.text,
    );

  const serialized =
    JSON.stringify({
    contractVersion:
      input.contractVersion,

    remediation: {
      sourceKey:
        input.sourceKey,
      severity:
        input.severity,
      questionPrompt:
        input.questionPrompt,
      title:
        input.title,
      summary:
        input.summary,
      requiredEvidence:
        input.requiredEvidence,
      requiredAttestations:
        input.requiredAttestations,
      remediationRecommendation:
        input.remediationRecommendation,
      releaseImpact:
        input.releaseImpact,
      evidenceSignal:
        input.evidenceSignal,
    },

    vendorSubmission: {
      vendorResponse:
        input.vendorResponse,
      evidenceRequestTitle:
        input.evidenceRequestTitle,
      evidenceRequestDescription:
        input.evidenceRequestDescription,
    },

    evidence: {
      title:
        input.evidenceTitle,
      description:
        input.evidenceDescription,
      kind:
        input.evidenceKind,
      uploadedAt:
        input.evidenceUploadedAt,
      documentDate:
        input.evidenceDocumentDate,
      validUntil:
        input.evidenceValidUntil,
      contextStatus:
        input.evidenceContext.status,
      contentType:
        input.evidenceContext.contentType,
      contentLength:
        input.evidenceContext.contentLength,
      text:
        evidenceText,
      reason:
        input.evidenceContext.reason,
    },
  });

  const serializedUtf8Bytes =
    Buffer.byteLength(
      serialized,
      "utf8",
    );

  if (
    serializedUtf8Bytes >
    OPENAI_REMEDIATION_REVIEW_MAX_INPUT_UTF8_BYTES
  ) {
    throw new Error(
      "OpenAI remediation review input exceeds the configured UTF-8 byte ceiling.",
    );
  }

  return serialized;
}

function extractOutputText(
  payload: UnknownRecord,
): string {
  /*
   * Responses API returns generated content inside output items.
   * Do not depend on SDK convenience properties because this driver
   * deliberately uses native fetch only.
   */
  const output = payload.output;

  if (!Array.isArray(output)) {
    throw new Error(
      "OpenAI remediation review response did not contain output items.",
    );
  }

  for (const item of output) {
    if (!isRecord(item)) {
      continue;
    }

    const content = item.content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (
        isRecord(part) &&
        part.type === "output_text" &&
        typeof part.text === "string" &&
        part.text.trim()
      ) {
        return part.text;
      }
    }
  }

  throw new Error(
    "OpenAI remediation review response did not contain structured output text.",
  );
}

export async function requestOpenAiRemediationReview(
  input: RemediationReviewInput,
  config: OpenAiRemediationReviewConfig,
): Promise<OpenAiRemediationReviewResponse> {
  const apiKey =
    requireNonEmptyString(
      config.apiKey,
      "OpenAI API key",
    );

  const model =
    config.model?.trim() ||
    DEFAULT_OPENAI_REMEDIATION_REVIEW_MODEL;

  const timeoutMs =
    normalizeTimeoutMs(
      config.timeoutMs,
    );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      timeoutMs,
    );

  let response: Response;

  try {
    response =
      await fetch(
        OPENAI_REMEDIATION_REVIEW_ENDPOINT,
        {
          method: "POST",
          headers: {
            authorization:
              `Bearer ${apiKey}`,
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            model,
            instructions:
              buildSystemInstructions(),
            input:
              buildReviewInput(input),

            /*
             * Do not retain vendor remediation evidence
             * in provider response storage.
             */
            store: false,

            max_output_tokens:
              OPENAI_REMEDIATION_REVIEW_MAX_OUTPUT_TOKENS,

            text: {
              format: {
                type:
                  "json_schema",
                name:
                  "truvern_remediation_review",
                strict:
                  true,
                schema:
                  REMEDIATION_REVIEW_JSON_SCHEMA,
              },
            },
          }),
          signal:
            controller.signal,
          cache:
            "no-store",
        },
      );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `OpenAI remediation review returned HTTP ${response.status}.`,
    );
  }

  const payload: unknown =
    await response.json();

  if (!isRecord(payload)) {
    throw new Error(
      "OpenAI remediation review returned an invalid response.",
    );
  }

  const outputText =
    extractOutputText(payload);

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(outputText);
  } catch {
    throw new Error(
      "OpenAI remediation review returned invalid structured JSON.",
    );
  }

  const result =
    parseReviewResult(
      parsed,
      input.contractVersion,
    );

  const usage =
    isRecord(payload.usage)
      ? payload.usage
      : {};

  const inputTokens =
    nullableInteger(
      usage.input_tokens,
    );

  const outputTokens =
    nullableInteger(
      usage.output_tokens,
    );

  const totalTokens =
    nullableInteger(
      usage.total_tokens,
    );

  return {
    result,
    providerRequestId:
      typeof payload.id === "string" &&
      payload.id.trim()
        ? payload.id.trim()
        : null,
    model,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
    },
  };
}
