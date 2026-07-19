import { buildEvidenceManifest, type EvidenceManifestItem } from "@/lib/evidence/manifest";

export type EvidenceSnapshot = {
  snapshotVersion: "TRV-EVIDENCE-SNAPSHOT-1.0";
  frozenAt: string;
  source: "review" | "vendor" | "release";
  sourceId: number;
  manifest: ReturnType<typeof buildEvidenceManifest>;
};

export function buildEvidenceSnapshot(input: {
  source: "review" | "vendor" | "release";
  sourceId: number;
  items: EvidenceManifestItem[];
}): EvidenceSnapshot {
  return {
    snapshotVersion: "TRV-EVIDENCE-SNAPSHOT-1.0",
    frozenAt: new Date().toISOString(),
    source: input.source,
    sourceId: input.sourceId,
    manifest: buildEvidenceManifest(input.items),
  };
}

