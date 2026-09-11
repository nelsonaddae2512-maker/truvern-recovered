import "server-only";

import type {
  RemediationReviewInput,
  RemediationReviewResult,
} from "@/lib/workflow/remediation-review-contract";

export const REMEDIATION_REVIEW_AI_ADAPTER_VERSION =
  "TRV-REMEDIATION-AI-ADAPTER-1.0" as const;

export type RemediationReviewAiAdapterConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
};

export type RemediationReviewAiAdapterRequest = {
  input: RemediationReviewInput;
};

export type RemediationReviewAiAdapterResponse = {
  result: RemediationReviewResult;
  providerRequestId: string | null;
  model: string;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

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

function normalizeEndpoint(endpoint: string): string {
  const normalized =
    requireNonEmptyString(
      endpoint,
      "AI remediation review endpoint",
    );

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(
      "AI remediation review endpoint must be an absolute URL.",
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      "AI remediation review endpoint must use HTTPS.",
    );
  }

  return parsed.toString();
}

function normalizeTimeoutMs(
  timeoutMs: number | undefined,
): number {
  if (timeoutMs == null) {
    return DEFAULT_TIMEOUT_MS;
  }

  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `AI remediation review timeout must be an integer between 1 and ${MAX_TIMEOUT_MS} milliseconds.`,
    );
  }

  return timeoutMs;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
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
      `AI remediation review response ${label} must be a string array.`,
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
        "AI remediation review response contains an invalid recommendation.",
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
        "AI remediation review response contains invalid evidence sufficiency.",
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
        "AI remediation review response contains invalid requirement coverage.",
      );
  }
}

function parseResult(
  value: unknown,
  contractVersion: RemediationReviewResult["contractVersion"],
): RemediationReviewResult {
  if (!isRecord(value)) {
    throw new Error(
      "AI remediation review response result must be an object.",
    );
  }

  if (value.contractVersion !== contractVersion) {
    throw new Error(
      "AI remediation review response contract version mismatch.",
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
      "AI remediation review response confidence must be between 0 and 1.",
    );
  }

  if (
    typeof value.rationale !== "string" ||
    !value.rationale.trim()
  ) {
    throw new Error(
      "AI remediation review response rationale is required.",
    );
  }

  /*
   * The AI adapter is advisory only.
   * A provider is never permitted to remove human review authority.
   */
  if (value.requiresHumanReview !== true) {
    throw new Error(
      "AI remediation review response must require human review.",
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
    rationale: value.rationale.trim(),
    requiresHumanReview: true,
  };
}

export async function requestRemediationReview(
  request: RemediationReviewAiAdapterRequest,
  config: RemediationReviewAiAdapterConfig,
): Promise<RemediationReviewAiAdapterResponse> {
  const endpoint =
    normalizeEndpoint(config.endpoint);

  const apiKey =
    requireNonEmptyString(
      config.apiKey,
      "AI remediation review API key",
    );

  const model =
    requireNonEmptyString(
      config.model,
      "AI remediation review model",
    );

  const timeoutMs =
    normalizeTimeoutMs(config.timeoutMs);

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
      await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          adapterVersion:
            REMEDIATION_REVIEW_AI_ADAPTER_VERSION,
          model,
          input: request.input,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `AI remediation review provider returned HTTP ${response.status}.`,
    );
  }

  const payload: unknown =
    await response.json();

  if (!isRecord(payload)) {
    throw new Error(
      "AI remediation review provider returned an invalid response.",
    );
  }

  const result =
    parseResult(
      payload.result,
      request.input.contractVersion,
    );

  const providerRequestId =
    typeof payload.providerRequestId === "string" &&
    payload.providerRequestId.trim()
      ? payload.providerRequestId.trim()
      : null;

  return {
    result,
    providerRequestId,
    model,
  };
}
