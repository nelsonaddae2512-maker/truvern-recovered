import crypto from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || "";
const region = process.env.AWS_REGION || process.env.S3_REGION || "us-east-1";

export const EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;

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

