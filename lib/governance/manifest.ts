import { createHash } from "node:crypto";
import {
  signGovernancePayload,
  verifyGovernanceSignature,
  type GovernanceSignatureBundle,
} from "@/lib/governance/signing";

export const GOVERNANCE_MANIFEST_VERSION = "GRM-1.0";
export const GOVERNANCE_VERSION = "TRV-GOV-1.0";

export type GovernanceManifestSnapshot = Record<string, unknown>;

export type GovernanceManifestInput = {
  organizationId: number;
  vendorId?: number | null;
  assessmentRunId?: number | null;
  reviewAssignmentId?: number | null;
  reviewResponseId?: number | null;

  releaseState: string;
  reviewerName?: string | null;

  releasedAt?: string | Date | null;
  confirmedAt?: string | Date | null;
  finalizedAt?: string | Date | null;

  packetChecksum?: string | null;
  fundingChecksum?: string | null;

  snapshot: GovernanceManifestSnapshot;
};

export type BuiltGovernanceManifest = {
  manifestVersion: string;
  governanceVersion: string;
  organizationId: number;
  vendorId: number | null;
  assessmentRunId: number | null;
  reviewAssignmentId: number | null;
  reviewResponseId: number | null;
  releaseState: string;
  reviewerName: string | null;
  releasedAt: string | null;
  confirmedAt: string | null;
  finalizedAt: string | null;
  packetChecksum: string | null;
  fundingChecksum: string | null;
  immutableSnapshot: GovernanceManifestSnapshot;
  checksum: string;
  signature?: GovernanceSignatureBundle;
  publicKeyFingerprint?: string;
};

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown) {
  const s = normalizeString(value);
  return s || null;
}

function normalizeNullableNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJson(item));
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(input).sort()) {
      output[key] = sortJson(input[key]);
    }

    return output;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? null;
}

export function sha256Hex(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function generateManifestChecksum(input: Omit<BuiltGovernanceManifest, "checksum">) {
  return sha256Hex({
    manifestVersion: input.manifestVersion,
    governanceVersion: input.governanceVersion,
    organizationId: input.organizationId,
    vendorId: input.vendorId,
    assessmentRunId: input.assessmentRunId,
    reviewAssignmentId: input.reviewAssignmentId,
    reviewResponseId: input.reviewResponseId,
    releaseState: input.releaseState,
    reviewerName: input.reviewerName,
    releasedAt: input.releasedAt,
    confirmedAt: input.confirmedAt,
    finalizedAt: input.finalizedAt,
    packetChecksum: input.packetChecksum,
    fundingChecksum: input.fundingChecksum,
    immutableSnapshot: input.immutableSnapshot,
  }).toUpperCase();
}

export function buildGovernanceManifest(
  input: GovernanceManifestInput,
): BuiltGovernanceManifest {
  const immutableSnapshot = sortJson(input.snapshot) as GovernanceManifestSnapshot;

  const withoutChecksum: Omit<BuiltGovernanceManifest, "checksum"> = {
    manifestVersion: GOVERNANCE_MANIFEST_VERSION,
    governanceVersion: GOVERNANCE_VERSION,
    organizationId: input.organizationId,
    vendorId: normalizeNullableNumber(input.vendorId),
    assessmentRunId: normalizeNullableNumber(input.assessmentRunId),
    reviewAssignmentId: normalizeNullableNumber(input.reviewAssignmentId),
    reviewResponseId: normalizeNullableNumber(input.reviewResponseId),
    releaseState: normalizeString(input.releaseState).toUpperCase() || "UNKNOWN",
    reviewerName: normalizeNullableString(input.reviewerName),
    releasedAt: normalizeDate(input.releasedAt),
    confirmedAt: normalizeDate(input.confirmedAt),
    finalizedAt: normalizeDate(input.finalizedAt),
    packetChecksum: normalizeNullableString(input.packetChecksum),
    fundingChecksum: normalizeNullableString(input.fundingChecksum),
    immutableSnapshot,
  };

  return {
    ...withoutChecksum,
    checksum: generateManifestChecksum(withoutChecksum),
  };
}

export function buildSignedGovernanceManifest(
  input: GovernanceManifestInput,
): BuiltGovernanceManifest {
  const manifest = buildGovernanceManifest(input);

  const signaturePayload = {
    ...manifest,
    signature: undefined,
    publicKeyFingerprint: undefined,
  };

  const signature = signGovernancePayload(signaturePayload);

  const publicKeyFingerprint = sha256Hex(signature.publicKey).toUpperCase();

  return {
    ...manifest,
    signature,
    publicKeyFingerprint,
  };
}

export function verifySignedGovernanceManifest(
  manifest: BuiltGovernanceManifest,
) {
  if (!manifest.signature) {
    return false;
  }

  const signaturePayload = {
    ...manifest,
    signature: undefined,
    publicKeyFingerprint: undefined,
  };

  return verifyGovernanceSignature(signaturePayload, manifest.signature);
}

