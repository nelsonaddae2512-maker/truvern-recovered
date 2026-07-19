import prisma from "@/lib/prisma";
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
    const updated: any[] = await prisma.$queryRawUnsafe(
      `
      update "WorkflowQueueItem"
      set
        queue = $1,
        status = $2,
        priority = $3,
        "workflowId" = $4,
        "dueAt" = $5,
        payload = coalesce(payload, '{}'::jsonb) || $6::jsonb,
        "updatedAt" = now()
      where payload->>'remediationPackageId' = $7
      returning id
      `,
      input.queue,
      status,
      priority,
      input.workflowId,
      input.dueAt ?? null,
      JSON.stringify(input.payload ?? {}),
      String(packageId),
    );

    if (updated.length > 0) return updated[0];
  }

  const inserted: any[] = await prisma.$queryRawUnsafe(
    `
    insert into "WorkflowQueueItem" (
      "workflowId",
      "organizationId",
      "vendorId",
      "reviewAssignmentId",
      queue,
      status,
      priority,
      "dueAt",
      payload,
      "createdAt",
      "updatedAt"
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now(), now())
    returning id
    `,
    input.workflowId,
    input.organizationId,
    input.vendorId ?? null,
    input.reviewAssignmentId ?? null,
    input.queue,
    status,
    priority,
    input.dueAt ?? null,
    JSON.stringify({
      ...(input.payload ?? {}),
      remediationPackageId: packageId,
    }),
  );

  return inserted[0] ?? null;
}
