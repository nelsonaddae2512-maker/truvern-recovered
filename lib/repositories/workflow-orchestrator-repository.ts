import prisma from "@/lib/prisma";

export async function readWorkflowOrchestratorQueueItems(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      qi.id,
      qi."workflowId",
      qi."organizationId",
      qi."vendorId",
      qi."reviewAssignmentId",
      qi.queue,
      qi.status,
      qi.priority,
      qi."assignedTo",
      qi."dueAt",
      qi.payload,
      rp.id as "packageId",
      rp.status as "packageStatus",
      rp.severity
    from "WorkflowQueueItem" qi
    left join "RemediationPackage" rp
      on qi.payload->>'remediationPackageId' = rp.id::text
    where qi.status = 'OPEN'
  `;
}

export async function updateWorkflowOrchestratorQueueItem(
  priority: number,
  payloadJson: string,
  queueItemId: number,
): Promise<void> {
  await prisma.$executeRaw`
    update "WorkflowQueueItem"
    set
      priority = ${priority},
      payload = coalesce(payload, '{}'::jsonb) || ${payloadJson}::jsonb,
      "updatedAt" = now()
    where id = ${queueItemId}
  `;
}

export async function insertWorkflowOrchestratorEscalationEvent(
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
      'WORKFLOW_ESCALATED',
      'WORKFLOW_ORCHESTRATOR',
      'Workflow item escalated by orchestrator.',
      ${payloadJson}::jsonb,
      now()
    )
  `;
}