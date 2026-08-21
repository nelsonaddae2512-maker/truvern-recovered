import { runWorkflowScheduler } from "@/lib/workflow/workflow-scheduler";
import { runWorkflowOrchestrator } from "@/lib/workflow/workflow-orchestrator";
import { runAiReviewWorker } from "@/lib/workflow/ai-review-worker";
import { runReleaseReadinessEngine } from "@/lib/workflow/release-readiness-engine";
import { runGovernanceReleaseGateEngine } from "@/lib/workflow/governance-release-gate-engine";

import { createWorkflowEvent } from "@/lib/repositories/workflow-event-repository";
type StageResult = {
  stage: string;
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  result?: any;
  error?: string;
};

async function runStage(stage: string, fn: () => Promise<any>): Promise<StageResult> {
  const started = Date.now();
  const startedAt = new Date().toISOString();

  try {
    const result = await fn();

    return {
      stage,
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      result,
    };
  } catch (error: any) {
    return {
      stage,
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      error: String(error?.message || error || "Stage failed."),
    };
  }
}

export async function runTruvernWorkflowExecution() {
  const executionStartedAt = new Date().toISOString();

  const stages: StageResult[] = [];

  stages.push(await runStage("WORKFLOW_SCHEDULER", runWorkflowScheduler));
  stages.push(await runStage("WORKFLOW_ORCHESTRATOR", runWorkflowOrchestrator));
  stages.push(await runStage("AI_REVIEW_WORKER", runAiReviewWorker));
  stages.push(await runStage("RELEASE_READINESS", runReleaseReadinessEngine));
  stages.push(await runStage("GOVERNANCE_RELEASE_GATE", runGovernanceReleaseGateEngine));

  const ok = stages.every((stage) => stage.ok);
  const failedStages = stages.filter((stage) => !stage.ok).map((stage) => stage.stage);
  const durationMs =
    new Date(stages[stages.length - 1]?.finishedAt || new Date()).getTime() -
    new Date(executionStartedAt).getTime();

  await createWorkflowEvent({
    data: {
      workflowId: null,
      organizationId: 1,
      vendorId: null,
      reviewAssignmentId: null,
      type: ok
        ? "TRUVERN_WORKFLOW_EXECUTION_COMPLETED"
        : "TRUVERN_WORKFLOW_EXECUTION_FAILED",
      actor: "TRUVERN_WORKFLOW_EXECUTION_ENGINE",
      summary: ok
        ? "Truvern workflow execution completed."
        : `Truvern workflow execution failed: ${failedStages.join(", ")}`,
      payload: {
        ok,
        executionStartedAt,
        executionFinishedAt: new Date().toISOString(),
        durationMs,
        stages,
        failedStages,
      },
    },
  });

  return {
    ok,
    executionStartedAt,
    executionFinishedAt: new Date().toISOString(),
    durationMs,
    failedStages,
    stages,
  };
}
