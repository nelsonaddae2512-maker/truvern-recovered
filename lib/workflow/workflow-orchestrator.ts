import { generateWorkflowTasksForPackage } from "@/lib/workflow/workflow-task-engine";
import { runAiReviewWorker } from "@/lib/workflow/ai-review-worker";
import {
  insertWorkflowOrchestratorEscalationEvent,
  readWorkflowOrchestratorQueueItems,
  updateWorkflowOrchestratorQueueItem,
} from "@/lib/repositories/workflow-orchestrator-repository";

type OrchestratorResult = {
  checked: number;
  assigned: number;
  escalated: number;
  readyForRelease: number;
  tasksGenerated: number;
  aiCompleted: number;
};

function priorityBoost(queue: string, slaState: string, assignedTo: string | null) {
  let boost = 0;

  if (queue === "EVIDENCE_WAITING_REVIEW") boost += 10;
  if (queue === "READY_FOR_RELEASE_CHECK") boost += 15;
  if (slaState === "DUE_SOON") boost += 20;
  if (slaState === "OVERDUE") boost += 40;
  if (!assignedTo) boost += 5;

  return boost;
}

export async function runWorkflowOrchestrator(): Promise<OrchestratorResult> {
  const rows: any[] =
    await readWorkflowOrchestratorQueueItems();

  let assigned = 0;
  let escalated = 0;
  let readyForRelease = 0;
  let tasksGenerated = 0;

  for (const item of rows) {
    const dueAt = item.dueAt ? new Date(item.dueAt) : null;
    const now = new Date();

    let slaState = "NO_SLA";

    if (dueAt && !Number.isNaN(dueAt.getTime())) {
      const hoursRemaining = Math.ceil((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60));
      if (hoursRemaining < 0) slaState = "OVERDUE";
      else if (hoursRemaining <= 24) slaState = "DUE_SOON";
      else slaState = "ON_TRACK";
    }

    const boost = priorityBoost(item.queue, slaState, item.assignedTo);
    const nextPriority = Math.min(100, Math.max(Number(item.priority || 0), Number(item.priority || 0) + boost));

    let orchestratorState = "MONITORED";

    if (slaState === "OVERDUE") {
      orchestratorState = "ESCALATED";
      escalated++;
    } else if (!item.assignedTo && item.queue !== "VENDOR_WAITING_RESPONSE") {
      orchestratorState = "READY_TO_ASSIGN";
    } else if (item.queue === "READY_FOR_RELEASE_CHECK") {
      orchestratorState = "READY_FOR_RELEASE";
      readyForRelease++;
    }

    await updateWorkflowOrchestratorQueueItem(
      nextPriority,
      JSON.stringify({
        orchestrator: {
          checkedAt: now.toISOString(),
          state: orchestratorState,
          slaState,
          priorityBoost: boost,
        },
      }),
      item.id,
    );

    if (orchestratorState === "ESCALATED") {
      await insertWorkflowOrchestratorEscalationEvent(
        item.workflowId,
        item.organizationId,
        item.vendorId,
        item.reviewAssignmentId,
        JSON.stringify({
          queueItemId: item.id,
          queue: item.queue,
          slaState,
          packageId: item.packageId,
        }),
      );
    }
  }

  const aiResult = await runAiReviewWorker();

  return {
    checked: rows.length,
    assigned,
    escalated,
    readyForRelease,
    tasksGenerated,
    aiCompleted: Number(aiResult.completed ?? 0),
  };
}


