import prisma from "@/lib/prisma";

export async function readWorkflowTaskPackage(
  packageId: any,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      rp.id,
      rp."reviewAssignmentId",
      rp."vendorId",
      rp."organizationId",
      rp."dueAt",
      rp.severity,
      rp.payload,
      wi.id as "workflowId",
      qi.id as "queueItemId"
    from "RemediationPackage" rp
    left join "WorkflowInstance" wi
      on wi."reviewAssignmentId" = rp."reviewAssignmentId"
     and wi."vendorId" = rp."vendorId"
     and wi.type = 'VENDOR_GOVERNANCE_REVIEW'
    left join "WorkflowQueueItem" qi
      on qi.payload->>'remediationPackageId' = rp.id::text
    where rp.id = ${packageId}
    limit 1
  `;
}

export async function findExistingWorkflowTask(
  packageId: any,
  type: any,
  title: any,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select id
    from "WorkflowTask"
    where "packageId" = ${packageId}
      and type = ${type}
      and title = ${title}
    limit 1
  `;
}

export async function insertWorkflowTask(
  workflowId: any,
  queueItemId: any,
  packageId: any,
  reviewAssignmentId: any,
  vendorId: any,
  organizationId: any,
  type: any,
  title: any,
  description: any,
  priority: any,
  slaDueAt: any,
  estimatedMinutes: any,
  payloadJson: any,
): Promise<void> {
  await prisma.$executeRaw`
    insert into "WorkflowTask" (
      "workflowId",
      "queueItemId",
      "packageId",
      "reviewAssignmentId",
      "vendorId",
      "organizationId",
      type,
      title,
      description,
      status,
      priority,
      "slaDueAt",
      "estimatedMinutes",
      payload,
      "createdAt",
      "updatedAt"
    )
    values (
      ${workflowId},
      ${queueItemId},
      ${packageId},
      ${reviewAssignmentId},
      ${vendorId},
      ${organizationId},
      ${type},
      ${title},
      ${description},
      'OPEN',
      ${priority},
      ${slaDueAt},
      ${estimatedMinutes},
      ${payloadJson}::jsonb,
      now(),
      now()
    )
  `;
}

export async function insertWorkflowTasksGeneratedEvent(
  workflowId: any,
  organizationId: any,
  vendorId: any,
  reviewAssignmentId: any,
  actor: any,
  summary: any,
  payloadJson: any,
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
      'WORKFLOW_TASKS_GENERATED',
      ${actor},
      ${summary},
      ${payloadJson}::jsonb,
      now()
    )
  `;
}

export async function claimWorkflowTaskRow(
  reviewerId: any,
  reviewerName: any,
  taskId: any,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    update "WorkflowTask"
    set
      "assignedTo" = ${reviewerId},
      "assignedReviewerName" = ${reviewerName},
      status =
        case
          when status = 'OPEN' then 'IN_PROGRESS'
          else status
        end,
      "startedAt" = coalesce("startedAt", now()),
      "updatedAt" = now()
    where id = ${taskId}
      and status in ('OPEN', 'IN_PROGRESS')
    returning *
  `;
}

export async function readWorkflowTaskCompletionCounts(
  packageId: any,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      count(*)::int as total,
      count(*) filter (
        where status = 'COMPLETED'
      )::int as completed
    from "WorkflowTask"
    where "packageId" = ${packageId}
      and status <> 'CANCELLED'
  `;
}

export async function completeWorkflowTaskRow(
  result: any,
  notes: any,
  taskId: any,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    update "WorkflowTask"
    set
      status = 'COMPLETED',
      result = ${result},
      notes = ${notes},
      "completedAt" = now(),
      "updatedAt" = now()
    where id = ${taskId}
    returning *
  `;
}