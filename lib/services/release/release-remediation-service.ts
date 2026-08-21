import { createHash } from "node:crypto";

export type ReleaseEvidenceRequestRow = {
  id: number;
  title: string | null;
  status: string | null;
  kind: string | null;
  dueAt: Date | string | null;
  fulfilledAt: Date | string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

export type NormalizedRemediationRequest = {
  id: number;
  title: string;
  status: string;
  kind: string;
  dueAt: string | null;
  fulfilledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type RemediationSnapshot = {
  schema: "truvern.remediation_snapshot.v1";
  generatedAt: string;
  vendorId: number | null;
  reviewAssignmentId: number;
  reviewResponseId: number;
  remediationOpenCount: number;
  remediationApprovedCount: number;
  remediationRejectedCount: number;
  remediationCount: number;
  remediationChecksum: string;
  remediationRequests: NormalizedRemediationRequest[];
};

export type BuildRemediationSnapshotInput = {
  rows: ReleaseEvidenceRequestRow[];
  confirmedAt: string;
  assignmentId: number;
  responseId: number;
  vendorId: number | null;
};

export type BuildRemediationSnapshotResult = {
  remediationRequests: NormalizedRemediationRequest[];
  remediationOpenCount: number;
  remediationApprovedCount: number;
  remediationRejectedCount: number;
  remediationChecksum: string;
  remediationSnapshot: RemediationSnapshot;
};

const CLOSED_REMEDIATION_STATUSES = new Set([
  "APPROVED",
  "RECEIVED",
  "COMPLETED",
  "FULFILLED",
  "RESOLVED",
  "REJECTED",
  "VERIFIED",
  "CLOSED",
]);

const APPROVED_REMEDIATION_STATUSES = new Set([
  "APPROVED",
  "RECEIVED",
  "COMPLETED",
  "FULFILLED",
  "RESOLVED",
]);

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function upper(value: unknown): string {
  return safeString(value).toUpperCase();
}

function toIsoString(
  value: Date | string | null,
): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date
    ? value
    : new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

export function buildRemediationSnapshot(
  input: BuildRemediationSnapshotInput,
): BuildRemediationSnapshotResult {
  const remediationRequests =
    input.rows.map((row): NormalizedRemediationRequest => ({
      id: Number(row.id),
      title: safeString(row.title) || "Evidence request",
      status: upper(row.status) || "UNKNOWN",
      kind: upper(row.kind) || "OTHER",
      dueAt: toIsoString(row.dueAt),
      fulfilledAt: toIsoString(row.fulfilledAt),
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    }));

  const remediationOpenCount =
    remediationRequests.filter(
      (item) => !CLOSED_REMEDIATION_STATUSES.has(item.status),
    ).length;

  const remediationApprovedCount =
    remediationRequests.filter(
      (item) => APPROVED_REMEDIATION_STATUSES.has(item.status),
    ).length;

  const remediationRejectedCount =
    remediationRequests.filter(
      (item) => item.status === "REJECTED",
    ).length;

  const remediationChecksum = createHash("sha256")
    .update(JSON.stringify(remediationRequests))
    .digest("hex")
    .toUpperCase();

  const remediationSnapshot: RemediationSnapshot = {
    schema: "truvern.remediation_snapshot.v1",
    generatedAt: input.confirmedAt,
    vendorId: input.vendorId,
    reviewAssignmentId: input.assignmentId,
    reviewResponseId: input.responseId,
    remediationOpenCount,
    remediationApprovedCount,
    remediationRejectedCount,
    remediationCount: remediationRequests.length,
    remediationChecksum,
    remediationRequests,
  };

  return {
    remediationRequests,
    remediationOpenCount,
    remediationApprovedCount,
    remediationRejectedCount,
    remediationChecksum,
    remediationSnapshot,
  };
}
