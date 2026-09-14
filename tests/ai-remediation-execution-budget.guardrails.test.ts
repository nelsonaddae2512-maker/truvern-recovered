import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repositorySource = readFileSync(
  "lib/repositories/ai-review-worker-repository.ts",
  "utf8",
);

const executionSource = readFileSync(
  "lib/workflow/workflow-execution-engine.ts",
  "utf8",
);

function extractFunction(
  source: string,
  startMarker: string,
  endMarker: string,
) {
  const start = source.indexOf(startMarker);

  expect(start).toBeGreaterThanOrEqual(0);

  const end = source.indexOf(endMarker, start + startMarker.length);

  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
}

describe("AI remediation execution budget guardrails", () => {
  it("bounds the global AI review queue to one task per invocation", () => {
    const globalReader = extractFunction(
      repositorySource,
      "export async function readAiReviewWorkerTasks()",
      "export async function readAiReviewWorkerTaskById(",
    );

    expect(globalReader).toContain("wt.type = 'AI_PRE_REVIEW'");
    expect(globalReader).toContain("wt.status = 'OPEN'");
    expect(globalReader).toMatch(/\blimit\s+1\b/i);
    expect(globalReader).not.toMatch(/\blimit\s+25\b/i);
  });

  it("bounds the package AI review queue to one task per invocation", () => {
    const packageReader = extractFunction(
      repositorySource,
      "export async function readAiReviewWorkerTasksForPackage(",
      "export type AiReviewWorkerLease",
    );

    expect(packageReader).toContain('wt."packageId" = ${packageId}');
    expect(packageReader).toContain("wt.type = 'AI_PRE_REVIEW'");
    expect(packageReader).toContain("wt.status = 'OPEN'");
    expect(packageReader).toMatch(/\blimit\s+1\b/i);
  });

  it("does not execute a second direct AI worker stage in full workflow execution", () => {
    expect(executionSource).not.toContain(
      'import { runAiReviewWorker } from "@/lib/workflow/ai-review-worker";',
    );

    expect(executionSource).not.toContain(
      'runStage("AI_REVIEW_WORKER", runAiReviewWorker)',
    );
  });

  it("preserves the workflow orchestrator stage as the bounded AI path", () => {
    expect(executionSource).toContain(
      'import { runWorkflowOrchestrator } from "@/lib/workflow/workflow-orchestrator";',
    );

    expect(executionSource).toContain(
      'runStage("WORKFLOW_ORCHESTRATOR", runWorkflowOrchestrator)',
    );
  });
});