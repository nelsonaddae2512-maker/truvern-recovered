import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const repositoryPath = path.join(
  root,
  "lib",
  "repositories",
  "ai-review-worker-repository.ts",
);

const source = fs.readFileSync(repositoryPath, "utf8");

function claimFunctionSource(): string {
  const startMarker =
    "export async function claimAiReviewWorkerTaskLease(";

  const endMarker =
    "export async function aiReviewWorkerLeaseIsOwned(";

  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
}

describe("AI remediation provider-attempt budget guardrails", () => {
  it("uses a hard global one-attempt rolling 24-hour budget", () => {
    expect(source).toContain(
      'AI_REMEDIATION_PROVIDER_BUDGET_EVENT_KIND',
    );
    expect(source).toContain(
      '"AI_REMEDIATION_PROVIDER_ATTEMPT_RESERVED"',
    );
    expect(source).toContain(
      "AI_REMEDIATION_PROVIDER_BUDGET_WINDOW_HOURS = 24",
    );
    expect(source).toContain(
      "AI_REMEDIATION_PROVIDER_BUDGET_MAX_ATTEMPTS = 1",
    );
  });

  it("checks and reserves the budget inside the serialized claim transaction", () => {
    const claim = claimFunctionSource();

    const lockIndex = claim.indexOf(
      "pg_advisory_xact_lock",
    );

    const claimUpdateIndex = claim.indexOf(
      'update "WorkflowTask"',
    );

    const budgetCountIndex = claim.indexOf(
      'from "UsageEvent"',
    );

    const budgetInsertIndex = claim.indexOf(
      'insert into "UsageEvent"',
    );

    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(claimUpdateIndex).toBeGreaterThan(lockIndex);
    expect(budgetCountIndex).toBeGreaterThan(claimUpdateIndex);
    expect(budgetInsertIndex).toBeGreaterThan(budgetCountIndex);

    expect(claim).toContain(
      "AI_REMEDIATION_PROVIDER_BUDGET_EXHAUSTED",
    );
  });

  it("binds the reservation to the claimed task identity", () => {
    const claim = claimFunctionSource();

    expect(claim).toContain('"organizationId"');
    expect(claim).toContain('"vendorId"');
    expect(claim).toContain('"packageId"');

    expect(claim).toContain("${claimed.organizationId}");
    expect(claim).toContain("${claimed.vendorId}");
    expect(claim).toContain("${claimed.packageId}");
    expect(claim).toContain("${claimed.id}");
  });

  it("keeps provider and network execution outside the claim transaction", () => {
    const claim = claimFunctionSource();

    expect(claim).not.toContain("runRemediationReview");
    expect(claim).not.toContain("runAiReviewTasks");
    expect(claim).not.toContain("fetch(");
    expect(claim).not.toContain("api.openai.com");
  });

  it("preserves existing single-flight and atomic task-claim guards", () => {
    const claim = claimFunctionSource();

    expect(claim).toContain(
      "truvern-ai-review-global-single-flight",
    );

    expect(claim).toContain(
      "'TRUVERN_AI_RECOVERY'",
    );

    expect(claim).toContain(
      "and type = 'AI_PRE_REVIEW'",
    );

    expect(claim).toContain(
      "and status = 'OPEN'",
    );

    expect(claim).toContain(
      'and "assignedTo" is null',
    );

    expect(claim).toContain(
      "and coalesce(payload #>> '{aiReviewLease,token}', '') = ''",
    );
  });
});