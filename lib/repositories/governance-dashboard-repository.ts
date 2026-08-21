import prisma from "@/lib/prisma";

export async function readGovernanceQueueSummary(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      count(*) filter (where status = 'OPEN')::int as "openWork",
      count(*) filter (
        where queue = 'VENDOR_WAITING_RESPONSE'
          and status = 'OPEN'
      )::int as "waitingVendor",
      count(*) filter (
        where queue = 'EVIDENCE_WAITING_REVIEW'
          and status = 'OPEN'
      )::int as "waitingAnalyst",
      count(*) filter (
        where queue in (
          'READY_FOR_RELEASE_CHECK',
          'GOVERNANCE_RELEASE_READY'
        )
          and status = 'OPEN'
      )::int as "readyApproval",
      count(*) filter (
        where "dueAt" is not null
          and "dueAt" < now()
          and status = 'OPEN'
      )::int as "critical"
    from "WorkflowQueueItem"
  `;
}

export async function readGovernanceTaskSummary(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      count(*) filter (
        where status = 'OPEN'
      )::int as "openTasks",
      count(*) filter (
        where status = 'IN_PROGRESS'
      )::int as "inProgressTasks",
      count(*) filter (
        where status = 'COMPLETED'
      )::int as "completedTasks"
    from "WorkflowTask"
  `;
}

export async function readRecentGovernanceReviews(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      ra.id,
      v.name as "vendorName",
      ra.status,
      ra."updatedAt"
    from "ReviewAssignment" ra
    left join "Vendor" v
      on v.id = ra."vendorId"
    order by
      ra."updatedAt" desc nulls last,
      ra.id desc
    limit 6
  `;
}

export async function readGovernanceWorkload(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      coalesce(
        "assignedReviewerName",
        "assignedTo",
        'Unassigned'
      ) as name,
      count(*)::int as active,
      count(*) filter (
        where "slaDueAt" is not null
          and "slaDueAt" < now()
      )::int as overdue
    from "WorkflowTask"
    where status in ('OPEN','IN_PROGRESS')
    group by coalesce(
      "assignedReviewerName",
      "assignedTo",
      'Unassigned'
    )
    order by active desc
    limit 6
  `;
}

export async function readGovernanceWorkflowQueue(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      id,
      queue,
      status,
      priority,
      "reviewAssignmentId",
      "updatedAt",
      payload
    from "WorkflowQueueItem"
    where status = 'OPEN'
    order by
      priority desc,
      "updatedAt" desc
    limit 8
  `;
}

export async function readGovernanceAiQueue(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      id,
      title,
      status,
      priority,
      "assignedTo",
      "reviewAssignmentId",
      "updatedAt"
    from "WorkflowTask"
    where type = 'AI_PRE_REVIEW'
    order by
      case
        when status = 'OPEN' then 0
        when status = 'IN_PROGRESS' then 1
        else 2
      end,
      priority desc,
      "updatedAt" desc
    limit 6
  `;
}

export async function readGovernanceReleaseReady(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      qi.id,
      qi.queue,
      qi.status,
      qi.priority,
      qi."reviewAssignmentId",
      qi.payload,
      v.name as "vendorName",
      o.name as "organizationName"
    from "WorkflowQueueItem" qi
    left join "Vendor" v
      on v.id = qi."vendorId"
    left join "Organization" o
      on o.id = qi."organizationId"
    where qi.status = 'OPEN'
      and qi.queue in (
        'READY_FOR_RELEASE_CHECK',
        'GOVERNANCE_RELEASE_READY'
      )
    order by
      qi.priority desc,
      qi."updatedAt" desc
    limit 8
  `;
}