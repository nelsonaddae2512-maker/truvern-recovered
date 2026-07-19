import crypto from "crypto";
import { signGovernancePayload } from "@/lib/governance/signing";

function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex")
    .toUpperCase();
}

function pairwiseMerkleRoot(hashes: string[]): string | null {
  if (!hashes.length) return null;

  let level = hashes.map((hash) => hash.toUpperCase());

  while (level.length > 1) {
    const next: string[] = [];

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;

      next.push(sha256(`${left}:${right}`));
    }

    level = next;
  }

  return level[0] || null;
}

export function createTransparencyChainCheckpoint(input: {
  entryHashes: string[];
  latestEntryHash?: string | null;
  generatedAt?: string;
}) {
  const generatedAt = input.generatedAt || new Date().toISOString();

  const normalizedEntryHashes = input.entryHashes
    .map((hash) => String(hash || "").trim().toUpperCase())
    .filter(Boolean);

  const merkleRoot = pairwiseMerkleRoot(normalizedEntryHashes);

  const checkpoint = {
    checkpointVersion: "TRV-CHAIN-CHECKPOINT-1.0",
    generatedAt,
    entryCount: normalizedEntryHashes.length,
    latestEntryHash:
      input.latestEntryHash ||
      normalizedEntryHashes[normalizedEntryHashes.length - 1] ||
      null,
    merkleRoot,
  };

  const signature = signGovernancePayload(checkpoint);

  return {
    ...checkpoint,
    signature,
  };
}
