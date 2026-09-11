import crypto from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || "";
const region = process.env.AWS_REGION || process.env.S3_REGION || "us-east-1";

export const EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;

// Deliberately smaller than the upload ceiling. This bounds
// server-side evidence reads performed for advisory AI review.
export const AI_EVIDENCE_READ_MAX_BYTES = 2 * 1024 * 1024;

export type TrustedVendorEvidenceObject = {
  key: string;
  contentType: string | null;
  contentLength: number;
  bytes: Uint8Array;
};

export const ALLOWED_EVIDENCE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export type EvidenceUploadTarget = {
  assessmentId: number;
  responseId?: number | null;
  remediationId?: number | null;
  attestationId?: number | null;
  filename: string;
  contentType: string;
  sizeBytes?: number | null;
};

export function assertEvidenceStorageConfigured() {
  if (!bucket) {
    throw new Error("S3 bucket is not configured. Set AWS_S3_BUCKET or S3_BUCKET.");
  }
}

export function getEvidenceBucket() {
  assertEvidenceStorageConfigured();
  return bucket;
}

export function getEvidenceS3Client() {
  return new S3Client({ region });
}

export function sanitizeFilename(filename: string) {
  return filename
    .trim()
    .replace(/[^\w.\-() ]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 140);
}

export function validateEvidenceUpload(input: EvidenceUploadTarget) {
  if (!input.filename.trim()) throw new Error("filename is required.");
  if (!ALLOWED_EVIDENCE_TYPES.has(input.contentType)) {
    throw new Error("Unsupported evidence content type.");
  }

  if (input.sizeBytes && input.sizeBytes > EVIDENCE_MAX_BYTES) {
    throw new Error("Evidence file is too large. Maximum size is 25MB.");
  }
}

export function buildEvidenceKey(input: EvidenceUploadTarget) {
  const id = crypto.randomUUID();
  const safeName = sanitizeFilename(input.filename);
  const scope = input.responseId
    ? `responses/${input.responseId}`
    : input.remediationId
      ? `remediation/${input.remediationId}`
      : input.attestationId
        ? `attestations/${input.attestationId}`
        : "general";

  return `truvern/framework-assessments/${input.assessmentId}/${scope}/${id}-${safeName}`;
}

export async function createEvidenceUploadUrl(input: EvidenceUploadTarget) {
  validateEvidenceUpload(input);

  const key = buildEvidenceKey(input);
  const client = getEvidenceS3Client();
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: getEvidenceBucket(),
      Key: key,
      ContentType: input.contentType,
      Metadata: {
        assessmentId: String(input.assessmentId),
        responseId: input.responseId ? String(input.responseId) : "",
        remediationId: input.remediationId ? String(input.remediationId) : "",
        attestationId: input.attestationId ? String(input.attestationId) : "",
        classification: "governance-evidence",
        product: "truvern",
      },
    }),
    { expiresIn: 10 * 60 },
  );

  return {
    evidenceId: crypto.randomUUID(),
    bucket: getEvidenceBucket(),
    region,
    key,
    uploadUrl,
    method: "PUT",
    expiresInSeconds: 600,
    contentType: input.contentType,
    filename: sanitizeFilename(input.filename),
    sizeBytes: input.sizeBytes ?? null,
  };
}

function buildTrustedVendorEvidencePrefix(
  vendorId: number,
  evidenceRequestId: number,
) {
  if (!Number.isInteger(vendorId) || vendorId <= 0) {
    throw new Error("A valid vendorId is required.");
  }

  if (!Number.isInteger(evidenceRequestId) || evidenceRequestId <= 0) {
    throw new Error("A valid evidenceRequestId is required.");
  }

  return `truvern/vendor-evidence/${vendorId}/requests/${evidenceRequestId}/`;
}

function assertTrustedVendorEvidenceKey(
  key: string,
  vendorId: number,
  evidenceRequestId: number,
) {
  const trimmed = key.trim();

  if (!trimmed) {
    throw new Error("Evidence key is required.");
  }

  if (
    trimmed.includes("://") ||
    trimmed.startsWith("/") ||
    trimmed.includes("\\") ||
    trimmed.split("/").some((segment) => segment === "..")
  ) {
    throw new Error("Evidence key is not a trusted storage key.");
  }

  const prefix = buildTrustedVendorEvidencePrefix(
    vendorId,
    evidenceRequestId,
  );

  if (!trimmed.startsWith(prefix) || trimmed.length <= prefix.length) {
    throw new Error("Evidence key is outside the trusted vendor-evidence scope.");
  }

  return trimmed;
}

export async function readTrustedVendorEvidenceObject(input: {
  key: string;
  vendorId: number;
  evidenceRequestId: number;
  maxBytes?: number;
}): Promise<TrustedVendorEvidenceObject> {
  const key = assertTrustedVendorEvidenceKey(
    input.key,
    input.vendorId,
    input.evidenceRequestId,
  );

  const maxBytes = input.maxBytes ?? AI_EVIDENCE_READ_MAX_BYTES;

  if (
    !Number.isInteger(maxBytes) ||
    maxBytes <= 0 ||
    maxBytes > AI_EVIDENCE_READ_MAX_BYTES
  ) {
    throw new Error("Evidence read limit is invalid.");
  }

  const client = getEvidenceS3Client();

  const object = await client.send(
    new GetObjectCommand({
      Bucket: getEvidenceBucket(),
      Key: key,
    }),
  );

  if (
    typeof object.ContentLength === "number" &&
    object.ContentLength > maxBytes
  ) {
    throw new Error("Evidence object exceeds the permitted AI read size.");
  }

  const metadataVendorId = object.Metadata?.vendorid ?? null;
  const metadataEvidenceRequestId =
    object.Metadata?.evidencerequestid ?? null;

  if (
    metadataVendorId !== String(input.vendorId) ||
    metadataEvidenceRequestId !== String(input.evidenceRequestId)
  ) {
    throw new Error("Evidence object metadata does not match its trusted scope.");
  }

  if (!object.Body) {
    throw new Error("Evidence object body is missing.");
  }

  const bytes = await object.Body.transformToByteArray();

  if (bytes.byteLength > maxBytes) {
    throw new Error("Evidence object exceeds the permitted AI read size.");
  }

  return {
    key,
    contentType: object.ContentType ?? null,
    contentLength: bytes.byteLength,
    bytes,
  };
}
export type TrustedEvidenceTextContext = {
  extractionStatus: "TEXT_AVAILABLE" | "UNSUPPORTED_MEDIA_TYPE" | "EMPTY_TEXT";
  mediaType: string | null;
  text: string | null;
  byteLength: number;
};

export function extractTrustedEvidenceText(
  object: TrustedVendorEvidenceObject,
): TrustedEvidenceTextContext {
  const mediaType = object.contentType
    ? object.contentType.split(";", 1)[0]?.trim().toLowerCase() || null
    : null;

  const supported =
    mediaType === "text/plain" ||
    mediaType === "text/csv";

  if (!supported) {
    return {
      extractionStatus: "UNSUPPORTED_MEDIA_TYPE",
      mediaType,
      text: null,
      byteLength: object.bytes.byteLength,
    };
  }

  const text = new TextDecoder("utf-8", {
    fatal: false,
    ignoreBOM: true,
  })
    .decode(object.bytes)
    .replace(/\u0000/g, "")
    .trim();

  if (!text) {
    return {
      extractionStatus: "EMPTY_TEXT",
      mediaType,
      text: null,
      byteLength: object.bytes.byteLength,
    };
  }

  return {
    extractionStatus: "TEXT_AVAILABLE",
    mediaType,
    text,
    byteLength: object.bytes.byteLength,
  };
}

export async function createEvidenceDownloadUrl(key: string) {
  if (!key.trim()) throw new Error("Evidence key is required.");

  const client = getEvidenceS3Client();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getEvidenceBucket(),
      Key: key,
    }),
    { expiresIn: 5 * 60 },
  );
}

