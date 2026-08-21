import { createHash } from "node:crypto";

export type GovernanceChecksumInput = {
  assignmentId: number;
  vendorName?: string | null;
  decision: string;
  riskLevel: string;
  releaseState: string;
  executiveSummary: string;
  finalAssessment: string;
  conditions: string[];
  finalizedAt: unknown;
};

export function governanceChecksum(
  input: GovernanceChecksumInput,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        assignmentId: input.assignmentId,
        vendor: input.vendorName || null,
        decision: input.decision,
        riskLevel: input.riskLevel,
        releaseState: input.releaseState,
        executiveSummary: input.executiveSummary,
        finalAssessment: input.finalAssessment,
        conditions: input.conditions,
        finalizedAt: input.finalizedAt,
      }),
    )
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
}
