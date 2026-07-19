import crypto from "crypto";

export type RemediationSnapshotInput = {
  id: number;
  title?: string | null;
  status?: string | null;
  type?: string | null;
  dueDate?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export function buildRemediationSnapshot(
  rows: RemediationSnapshotInput[],
) {
  const normalized = rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title || ""),
    status: String(row.status || "UNKNOWN").toUpperCase(),
    type: String(row.type || "GENERAL").toUpperCase(),
    dueDate: row.dueDate
      ? new Date(row.dueDate).toISOString()
      : null,
    createdAt: row.createdAt
      ? new Date(row.createdAt).toISOString()
      : null,
    updatedAt: row.updatedAt
      ? new Date(row.updatedAt).toISOString()
      : null,
  }));

  const checksum = crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .toUpperCase();

  return {
    remediationCount: normalized.length,
    remediationChecksum: checksum,
    remediationRequests: normalized,
  };
}

