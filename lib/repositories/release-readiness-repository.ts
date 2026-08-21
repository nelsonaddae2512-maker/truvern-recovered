import prisma from "@/lib/prisma";

export async function readReleaseReadinessPackages(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      rp.id as "packageId",
      rp."reviewAssignmentId",
      rp."vendorId",
      rp."organizationId",
      rp.status as "packageStatus",
      rp.title as "packageTitle",
      qi.id as "queueItemId",
      qi."workflowId",
      qi.queue,
      qi.status as "queueStatus",
      qi.payload
    from "RemediationPackage" rp
    left join "WorkflowQueueItem" qi
      on qi.payload->>'remediationPackageId' = rp.id::text
    where qi.status = 'OPEN'
      and qi.queue = 'READY_FOR_RELEASE_CHECK'
      and rp.status in ('APPROVED','COMPLETED')
  `;
}

export async function readReleaseReadinessTaskCounts(
  packageId: number,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      count(*)::int as total,
      count(*) filter (
        where status = 'COMPLETED'
      )::int as completed,
      count(*) filter (
        where status not in ('COMPLETED','CANCELLED')
      )::int as open
    from "WorkflowTask"
    where "packageId" = ${packageId}
      and status <> 'CANCELLED'
  `;
}

export async function updateReleaseReadinessQueueItem(
  payloadJson: string,
  queueItemId: number,
): Promise<void> {
  await prisma.$executeRaw`
    update "WorkflowQueueItem"
    set
      payload = coalesce(payload, '{}'::jsonb) || ${payloadJson}::jsonb,
      "updatedAt" = now()
    where id = ${queueItemId}
  `;
}

export async function insertReleaseReadinessEvent(
  workflowId: number | null,
  organizationId: number,
  vendorId: number | null,
  reviewAssignmentId: number | null,
  readinessState: string,
  summary: string,
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
      ${readinessState},
      'RELEASE_READINESS_ENGINE',
      ${summary},
      ${payloadJson}::jsonb,
      now()
    )
  `;
}