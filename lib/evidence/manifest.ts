import { checksumJson, normalizeChecksum, safeStr } from "@/lib/evidence/checksum";

export type EvidenceManifestItem = {
  id: number | string;
  title: string;
  fileKey?: string | null;
  fileUrl?: string | null;
  status?: string | null;
  uploadedBy?: string | null;
  uploadedAt?: string | Date | null;
  reviewedAt?: string | Date | null;
  decision?: string | null;
  requestTitle?: string | null;
  checksum?: string | null;
};

export type EvidenceManifest = {
  manifestVersion: "TRV-EVIDENCE-MANIFEST-1.0";
  generatedAt: string;
  artifactCount: number;
  checksum: string;
  items: EvidenceManifestItem[];
};

function normalizeItem(item: EvidenceManifestItem): EvidenceManifestItem {
  return {
    id: item.id,
    title: safeStr(item.title) || "Evidence artifact",
    fileKey: safeStr(item.fileKey) || null,
    fileUrl: safeStr(item.fileUrl) || null,
    status: safeStr(item.status) || null,
    uploadedBy: safeStr(item.uploadedBy) || null,
    uploadedAt: item.uploadedAt ?? null,
    reviewedAt: item.reviewedAt ?? null,
    decision: safeStr(item.decision) || null,
    requestTitle: safeStr(item.requestTitle) || null,
    checksum: normalizeChecksum(item.checksum),
  };
}

export function buildEvidenceManifest(items: EvidenceManifestItem[]): EvidenceManifest {
  const normalized = items.map(normalizeItem);

  const payload: Omit<EvidenceManifest, "generatedAt" | "checksum"> = {
    manifestVersion: "TRV-EVIDENCE-MANIFEST-1.0",
    artifactCount: normalized.length,
    items: normalized,
  };

  return {
    manifestVersion: payload.manifestVersion,
    generatedAt: new Date().toISOString(),
    artifactCount: payload.artifactCount,
    checksum: checksumJson(payload),
    items: payload.items,
  };
}

