import prisma from "@/lib/prisma";

export async function readWorkflowSchedulerOpenItems(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      id,
      "workflowId",
      "organizationId",
      "vendorId",
      "reviewAssignmentId",
      queue,
      status,
      priority,
      "assignedTo",
      "dueAt",
      payload
    from "WorkflowQueueItem"
    where status = 'OPEN'
  `;
}

export async function updateWorkflowSchedulerQueueItem(
  payloadJson: string,
  priority: number,
  queueItemId: number,
): Promise<void> {
  await prisma.$executeRaw`
    update "WorkflowQueueItem"
    set
      payload = coalesce(payload, '{}'::jsonb) || ${payloadJson}::jsonb,
      priority = greatest(priority, ${priority}),
      "updatedAt" = now()
    where id = ${queueItemId}
  `;
}

export async function insertWorkflowSchedulerOverdueEvent(
  workflowId: number | null,
  organizationId: number,
  vendorId: number | null,
  reviewAssignmentId: number | null,
  payloadJson: string,
): Promise<void> {
  await prisma.$executeRaw`
    insert into "WorkflowEvent" (
      "workflowId",
      "organizationId",
      "vendorId",
      "reviewAssignmentId",
      type,
      actor,
      summary,
      payload,
      "createdAt"
    )
    values (
      ${workflowId},
      ${organizationId},
      ${vendorId},
      ${reviewAssignmentId},
      'SLA_OVERDUE',
      'WORKFLOW_SCHEDULER',
      'Workflow item is overdue.',
      ${payloadJson}::jsonb,
      now()
    )
  `;
}