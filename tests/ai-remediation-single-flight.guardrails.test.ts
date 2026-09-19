import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repositoryPath =
  "lib/repositories/ai-review-worker-repository.ts";

const source =
  readFileSync(repositoryPath, "utf8");

const claimStart =
  source.indexOf(
    "export async function claimAiReviewWorkerTaskLease(",
  );

const claimEnd =
  source.indexOf(
    "export async function finalizeOwnedAiReviewWorkerTask(",
    claimStart,
  );

const claimSource =
  source.slice(
    claimStart,
    claimEnd,
  );

describe("AI remediation global single-flight guardrails", () => {
  it("serializes claims with a transaction-scoped advisory lock", () => {
    expect(claimStart).toBeGreaterThan(-1);
    expect(claimEnd).toBeGreaterThan(claimStart);

    expect(claimSource).toContain(
      "return prisma.$transaction(async (tx) => {",
    );

    expect(claimSource).toContain(
      "pg_advisory_xact_lock(",
    );

    expect(claimSource).toContain(
      "truvern-ai-review-global-single-flight",
    );

    expect(claimSource).not.toContain(
      "pg_advisory_lock(",
    );
  });

  it("checks global active execution before the task update", () => {
    const blockerIndex =
      claimSource.indexOf(
        "const blockers",
      );

    const updateIndex =
      claimSource.indexOf(
        'update "WorkflowTask"',
      );

    expect(blockerIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(blockerIndex);

    expect(claimSource).toContain(
      "status = 'IN_PROGRESS'",
    );

    expect(claimSource).toContain(
      "'AI_WORKER'",
    );

    expect(claimSource).toContain(
      "'TRUVERN_AI_RECOVERY'",
    );
  });

  it("preserves the task-specific compare-and-claim guards", () => {
    expect(claimSource).toContain(
      "and status = 'OPEN'",
    );

    expect(claimSource).toContain(
      'and "assignedTo" is null',
    );

    expect(claimSource).toContain(
      "and coalesce(payload #>> '{aiReviewLease,token}', '') = ''",
    );
  });

  it("keeps provider execution outside the claim transaction", () => {
    expect(claimSource).not.toContain(
      "runRemediationReview",
    );

    expect(claimSource).not.toContain(
      "runAiReviewTasks",
    );

    expect(claimSource).not.toContain(
      "fetch(",
    );
  });
});