import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repositorySource = readFileSync(
  "lib/repositories/ai-review-worker-repository.ts",
  "utf8",
);

const workerSource = readFileSync(
  "lib/workflow/ai-review-worker.ts",
  "utf8",
);

function extract(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThanOrEqual(0);

  const end = source.indexOf(
    endMarker,
    start + startMarker.length,
  );

  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
}

describe("AI remediation claim outcome guardrails", () => {
  const claimSource = extract(
    repositorySource,
    "export async function claimAiReviewWorkerTaskLease(",
    "export async function finalizeOwnedAiReviewWorkerTask(",
  );

  const workerExecution = extract(
    workerSource,
    "async function runAiReviewTasks(",
    "export async function runAiReviewWorker()",
  );

  it("distinguishes global blocking from candidate-specific claim loss", () => {
    expect(repositorySource).toContain(
      'status: "GLOBAL_BLOCKED"',
    );

    expect(repositorySource).toContain(
      'status: "NOT_CLAIMABLE"',
    );

    expect(repositorySource).toContain(
      'status: "CLAIMED"',
    );

    expect(claimSource).not.toMatch(
      /\breturn\s+null\s*;/,
    );
  });

  it("stops candidate scanning on a global single-flight blocker", () => {
    expect(workerExecution).toMatch(
      /if \(lease\.status === "GLOBAL_BLOCKED"\) \{\s*break;\s*\}/,
    );
  });

  it("continues candidate scanning after a candidate-specific claim race", () => {
    expect(workerExecution).toMatch(
      /if \(lease\.status === "NOT_CLAIMABLE"\) \{\s*continue;\s*\}/,
    );
  });

  it("uses the owned lease only after a successful claim outcome", () => {
    const blockedIndex =
      workerExecution.indexOf(
        'lease.status === "GLOBAL_BLOCKED"',
      );

    const notClaimableIndex =
      workerExecution.indexOf(
        'lease.status === "NOT_CLAIMABLE"',
      );

    const ownedLeaseIndex =
      workerExecution.indexOf(
        "const ownedLease = lease.lease;",
      );

    const evidenceIndex =
      workerExecution.indexOf(
        "await readTrustedVendorEvidenceObject({",
      );

    const providerIndex =
      workerExecution.indexOf(
        "await requestOpenAiRemediationReview(",
      );

    expect(blockedIndex).toBeGreaterThanOrEqual(0);
    expect(notClaimableIndex).toBeGreaterThan(blockedIndex);
    expect(ownedLeaseIndex).toBeGreaterThan(notClaimableIndex);
    expect(evidenceIndex).toBeGreaterThan(ownedLeaseIndex);
    expect(providerIndex).toBeGreaterThan(evidenceIndex);
  });

  it("preserves claim serialization and provider-budget enforcement", () => {
    expect(claimSource).toContain(
      "truvern-ai-review-global-single-flight",
    );

    expect(claimSource).toContain(
      "AI_REMEDIATION_PROVIDER_BUDGET_EXHAUSTED",
    );

    expect(claimSource).toContain(
      "AI_REMEDIATION_PROVIDER_BUDGET_EVENT_KIND",
    );
  });
});