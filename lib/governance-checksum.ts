import { createHash } from "node:crypto";

export type GovernanceChecksumInput = {
  assignmentId: number;
  vendorName?: string | null;
  decision?: string | null;
  riskLevel?: string | null;
  releaseState?: string | null;
  executiveSummary?: string | null;
  finalAssessment?: string | null;
  conditions?: string[];
  finalizedAt?: unknown;
};

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export function createGovernanceChecksum(input: GovernanceChecksumInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        assignmentId: input.assignmentId,
        vendor: input.vendorName || null,
        decision: safeStr(input.decision),
        riskLevel: safeStr(input.riskLevel),
        releaseState: safeStr(input.releaseState).toUpperCase(),
        executiveSummary: safeStr(input.executiveSummary),
        finalAssessment: safeStr(input.finalAssessment),
        conditions: Array.isArray(input.conditions)
          ? input.conditions.map(String).map((v) => v.trim()).filter(Boolean)
          : [],
        finalizedAt: input.finalizedAt || null,
      }),
    )
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
}

