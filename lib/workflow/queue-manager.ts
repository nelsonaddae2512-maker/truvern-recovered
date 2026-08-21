import {
  insertWorkflowQueueItem,
  updateWorkflowQueueItemForPackage,
} from "@/lib/repositories/workflow-queue-repository";
import {
  QueueStatus,
  WorkflowStage,
  type WorkflowStageType,
  priorityForSeverity,
} from "@/lib/workflow/workflow-constants";

export async function upsertWorkflowQueueItem(input: {
  workflowId: number;
  packageId?: number | null;
  reviewAssignmentId?: number | null;
  vendorId?: number | null;
  organizationId: number;
  queue: WorkflowStageType;
  dueAt?: Date | string | null;
  severity?: string | null;
  payload?: Record<string, any>;
}) {
  const packageId = input.packageId ?? null;
  const priority = priorityForSeverity(input.severity);
  const status = input.queue === WorkflowStage.Complete ? QueueStatus.Closed : QueueStatus.Open;

  if (packageId) {
    const updated: any[] = await updateWorkflowQueueItemForPackage({
      queue: input.queue,
      status,
      priority,
      workflowId: input.workflowId,
      dueAt: input.dueAt ?? null,
      payloadJson: JSON.stringify(input.payload ?? {}),
      packageId,
    });

    if (updated.length > 0) return updated[0];
  }

  const inserted: any[] = await insertWorkflowQueueItem({
    workflowId: input.workflowId,
    organizationId: input.organizationId,
    vendorId: input.vendorId ?? null,
    reviewAssignmentId: input.reviewAssignmentId ?? null,
    queue: input.queue,
    status,
    priority,
    dueAt: input.dueAt ?? null,
    payloadJson: JSON.stringify({
      ...(input.payload ?? {}),
      remediationPackageId: packageId,
    }),
  });

  return inserted[0] ?? null;
}
