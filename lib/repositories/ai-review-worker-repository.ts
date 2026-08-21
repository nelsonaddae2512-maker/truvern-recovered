import prisma from "@/lib/prisma";

export async function readAiReviewWorkerTasks(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      wt.id,
      wt."packageId",
      wt."workflowId",
      wt."reviewAssignmentId",
      wt."vendorId",
      wt."organizationId",
      wt.title,
      wt.payload,
      rp.title as "packageTitle",
      rp.payload as "packagePayload"
    from "WorkflowTask" wt
    left join "RemediationPackage" rp on rp.id = wt."packageId"
    where wt.type = 'AI_PRE_REVIEW'
      and wt.status in ('OPEN','IN_PROGRESS')
    order by wt.priority desc, wt."createdAt" asc
    limit 25
  `;
}

export async function updateAiReviewWorkerTask(
  payloadJson: string,
  taskId: number,
): Promise<void> {
  await prisma.$executeRaw`
    update "WorkflowTask"
    set
      "assignedTo" = 'AI_WORKER',
      "assignedReviewerName" = 'Truvern AI Review Worker',
      status = 'IN_PROGRESS',
      "startedAt" = coalesce("startedAt", now()),
      payload = coalesce(payload, '{}'::jsonb) || ${payloadJson}::jsonb,
      "updatedAt" = now()
    where id = ${taskId}
  `;
}

export async function insertAiReviewWorkerCompletionEvent(
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
      'AI_PRE_REVIEW_COMPLETED',
      'AI_WORKER',
      'AI pre-review task completed.',
      ${payloadJson}::jsonb,
      now()
    )
  `;
}