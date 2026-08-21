import prisma from "@/lib/prisma";

export async function readGovernanceReleaseGateAssignments(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select distinct
      rp."reviewAssignmentId",
      rp."vendorId",
      rp."organizationId",
      wi.id as "workflowId"
    from "RemediationPackage" rp
    left join "WorkflowInstance" wi
      on wi."reviewAssignmentId" = rp."reviewAssignmentId"
     and wi."vendorId" = rp."vendorId"
     and wi.type = 'VENDOR_GOVERNANCE_REVIEW'
    where rp."reviewAssignmentId" is not null
  `;
}

export async function readGovernanceReleaseGateCounts(
  reviewAssignmentId: any,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      count(*)::int as "totalPackages",
      count(*) filter (
        where rp.status in ('APPROVED','COMPLETED')
          and coalesce(
            qi.payload->'releaseReadiness'->>'state',
            ''
          ) = 'READY_FOR_RELEASE'
      )::int as "readyPackages",
      count(*) filter (
        where coalesce(
          qi.payload->'releaseReadiness'->>'state',
          ''
        ) = 'RELEASE_BLOCKED'
           or rp.status not in ('APPROVED','COMPLETED')
      )::int as "blockedPackages"
    from "RemediationPackage" rp
    left join "WorkflowQueueItem" qi
      on qi.payload->>'remediationPackageId' = rp.id::text
    where rp."reviewAssignmentId" = ${reviewAssignmentId}
  `;
}

export async function updateGovernanceReleaseGateStage(
  gateState: any,
  releaseGatePayloadJson: any,
  workflowId: any,
): Promise<void> {
  await prisma.$executeRaw`
    update "WorkflowInstance"
    set
      "currentStage" = ${gateState},
      payload =
        coalesce(payload, '{}'::jsonb)
        || ${releaseGatePayloadJson}::jsonb,
      "updatedAt" = now()
    where id = ${workflowId}
  `;
}

export async function ensureGovernanceReleaseReadyQueueItem(
  workflowId: any,
  organizationId: any,
  vendorId: any,
  reviewAssignmentId: any,
  payloadJson: any,
): Promise<void> {
  await prisma.$executeRaw`
    insert into "WorkflowQueueItem" (
      "workflowId",
      "organizationId",
      "vendorId",
      "reviewAssignmentId",
      queue,
      status,
      priority,
      payload,
      "createdAt",
      "updatedAt"
    )
    select
      ${workflowId},
      ${organizationId},
      ${vendorId},
      ${reviewAssignmentId},
      'GOVERNANCE_RELEASE_READY',
      'OPEN',
      95,
      ${payloadJson}::jsonb,
      now(),
      now()
    where not exists (
      select 1
      from "WorkflowQueueItem"
      where "reviewAssignmentId" = ${reviewAssignmentId}
        and queue = 'GOVERNANCE_RELEASE_READY'
        and status = 'OPEN'
    )
  `;
}

export async function insertGovernanceReleaseGateEvent(
  workflowId: any,
  organizationId: any,
  vendorId: any,
  reviewAssignmentId: any,
  gateState: any,
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
      ${gateState},
      'GOVERNANCE_RELEASE_GATE_ENGINE',
      ${summary},
      ${payloadJson}::jsonb,
      now()
    )
  `;
}