import type { Prisma } from "@prisma/client";

export const TRUVERN_VENDOR_INTERACTION_RESPONSE_METADATA_KEY =
  "truvernVendorInteractionResponse" as const;

export const TRUVERN_VENDOR_INTERACTION_RESPONSE_VERSION =
  1 as const;

export const TRUVERN_VENDOR_INTERACTION_RESPONSE_MODES = [
  "CONFIRMED",
  "OVERRIDE",
] as const;

export type TruvernVendorInteractionResponseMode =
  (typeof TRUVERN_VENDOR_INTERACTION_RESPONSE_MODES)[number];

export type TruvernVendorInteractionResponseProvenance = {
  version: typeof TRUVERN_VENDOR_INTERACTION_RESPONSE_VERSION;
  interactionId: string;
  componentId: string;
  mode: TruvernVendorInteractionResponseMode;
  sharedAnswer: unknown;
  confirmedAt: string;
};

export type TruvernVendorInteractionResponseProvenanceInput = {
  interactionId: string;
  componentId: string;
  mode: TruvernVendorInteractionResponseMode;
  sharedAnswer: unknown;
  confirmedAt: string;
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

export function isTruvernVendorInteractionResponseMode(
  value: unknown,
): value is TruvernVendorInteractionResponseMode {
  return (
    typeof value === "string" &&
    (
      TRUVERN_VENDOR_INTERACTION_RESPONSE_MODES as readonly string[]
    ).includes(value)
  );
}

export function mergeTruvernVendorInteractionResponseProvenance(
  existingMetadata: unknown,
  input: TruvernVendorInteractionResponseProvenanceInput,
): Prisma.InputJsonValue {
  const existing =
    isRecord(existingMetadata)
      ? existingMetadata
      : {};

  const provenance:
    TruvernVendorInteractionResponseProvenance = {
      version:
        TRUVERN_VENDOR_INTERACTION_RESPONSE_VERSION,
      interactionId: input.interactionId,
      componentId: input.componentId,
      mode: input.mode,
      sharedAnswer: input.sharedAnswer,
      confirmedAt: input.confirmedAt,
    };

  return JSON.parse(
    JSON.stringify({
      ...existing,
      [TRUVERN_VENDOR_INTERACTION_RESPONSE_METADATA_KEY]:
        provenance,
    }),
  ) as Prisma.InputJsonValue;
}

export function readTruvernVendorInteractionResponseProvenance(
  metadata: unknown,
): TruvernVendorInteractionResponseProvenance | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const raw =
    metadata[
      TRUVERN_VENDOR_INTERACTION_RESPONSE_METADATA_KEY
    ];

  if (!isRecord(raw)) {
    return null;
  }

  const interactionId =
    nonEmptyString(raw.interactionId);

  const componentId =
    nonEmptyString(raw.componentId);

  const confirmedAt =
    nonEmptyString(raw.confirmedAt);

  if (
    raw.version !==
      TRUVERN_VENDOR_INTERACTION_RESPONSE_VERSION ||
    !interactionId ||
    !componentId ||
    !isTruvernVendorInteractionResponseMode(raw.mode) ||
    !confirmedAt
  ) {
    return null;
  }

  return {
    version:
      TRUVERN_VENDOR_INTERACTION_RESPONSE_VERSION,
    interactionId,
    componentId,
    mode: raw.mode,
    sharedAnswer: raw.sharedAnswer,
    confirmedAt,
  };
}
