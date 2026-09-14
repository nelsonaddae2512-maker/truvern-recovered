import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerSource = readFileSync(
  "lib/workflow/ai-review-worker.ts",
  "utf8",
);

function executionFunctionSource(): string {
  const startMarker =
    "async function runAiReviewTasks(";

  const endMarker =
    "export async function runAiReviewWorker()";

  const start =
    workerSource.indexOf(startMarker);

  const end =
    workerSource.indexOf(
      endMarker,
      start,
    );

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return workerSource.slice(
    start,
    end,
  );
}

describe(
  "AI remediation pre-claim eligibility guardrails",
  () => {
    it(
      "requires commercial and provider readiness before task claim",
      () => {
        const execution =
          executionFunctionSource();

        const commercialIndex =
          execution.indexOf(
            "const commercialEligibility =",
          );

        const runtimeIndex =
          execution.indexOf(
            "const runtimeEnabled =",
          );

        const apiKeyIndex =
          execution.indexOf(
            "const configuredApiKey =",
          );

        const preflightIndex =
          execution.indexOf(
            "!commercialEligibility.eligible ||",
          );

        const claimIndex =
          execution.indexOf(
            "const lease = await claimAiReviewWorkerTaskLease(",
          );

        expect(commercialIndex).
          toBeGreaterThanOrEqual(0);

        expect(runtimeIndex).
          toBeGreaterThan(commercialIndex);

        expect(apiKeyIndex).
          toBeGreaterThan(runtimeIndex);

        expect(preflightIndex).
          toBeGreaterThan(apiKeyIndex);

        expect(claimIndex).
          toBeGreaterThan(preflightIndex);
      },
    );

    it(
      "keeps evidence storage access after ownership is established",
      () => {
        const execution =
          executionFunctionSource();

        const claimIndex =
          execution.indexOf(
            "const lease = await claimAiReviewWorkerTaskLease(",
          );

        const evidenceIndex =
          execution.indexOf(
            "await readTrustedVendorEvidenceObject({",
          );

        expect(claimIndex).
          toBeGreaterThanOrEqual(0);

        expect(evidenceIndex).
          toBeGreaterThan(claimIndex);
      },
    );

    it(
      "keeps provider execution after claim and evidence preparation",
      () => {
        const execution =
          executionFunctionSource();

        const claimIndex =
          execution.indexOf(
            "const lease = await claimAiReviewWorkerTaskLease(",
          );

        const evidenceIndex =
          execution.indexOf(
            "await readTrustedVendorEvidenceObject({",
          );

        const providerIndex =
          execution.indexOf(
            "await requestOpenAiRemediationReview(",
          );

        expect(providerIndex).
          toBeGreaterThan(evidenceIndex);

        expect(providerIndex).
          toBeGreaterThan(claimIndex);
      },
    );

    it(
      "retains one global worker task per invocation",
      () => {
        const repositorySource =
          readFileSync(
            "lib/repositories/ai-review-worker-repository.ts",
            "utf8",
          );

        const start =
          repositorySource.indexOf(
            "export async function readAiReviewWorkerTasks()",
          );

        const end =
          repositorySource.indexOf(
            "export async function readAiReviewWorkerTaskById(",
            start,
          );

        expect(start).
          toBeGreaterThanOrEqual(0);

        expect(end).
          toBeGreaterThan(start);

        const reader =
          repositorySource.slice(
            start,
            end,
          );

        expect(reader).
          toMatch(/\blimit\s+1\b/i);
      },
    );
  },
);