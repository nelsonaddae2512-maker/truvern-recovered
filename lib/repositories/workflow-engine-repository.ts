import prisma from "@/lib/prisma";

export async function readWorkflowPackage(
  packageId: any,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      rp.id,
      rp."reviewAssignmentId",
      rp."vendorId",
      rp."organizationId",
      wi.id as "workflowId"
    from "RemediationPackage" rp
    left join "WorkflowInstance" wi
      on wi."reviewAssignmentId" = rp."reviewAssignmentId"
     and wi."vendorId" = rp."vendorId"
     and wi.type = 'VENDOR_GOVERNANCE_REVIEW'
    where rp.id = ${packageId}
    limit 1
  `;
}

export async function createWorkflowInstanceRow(
  organizationId: any,
  vendorId: any,
  reviewAssignmentId: any,
  queue: any,
  payloadJson: any,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    insert into "WorkflowInstance" (
      "organizationId",
      "vendorId",
      "reviewAssignmentId",
      type,
      status,
      priority,
      "currentStage",
      payload,
      "createdAt",
      "updatedAt"
    )
    values (
      ${organizationId},
      ${vendorId},
      ${reviewAssignmentId},
      'VENDOR_GOVERNANCE_REVIEW',
      'ACTIVE',
      'NORMAL',
      ${queue},
      ${payloadJson}::jsonb,
      now(),
      now()
    )
    returning id
  `;
}

export async function insertWorkflowTransitionEvent(
  workflowId: any,
  organizationId: any,
  vendorId: any,
  reviewAssignmentId: any,
  type: any,
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
      ${type},
      ${actor},
      ${summary},
      ${payloadJson}::jsonb,
      now()
    )
  `;
}

export async function updateWorkflowInstanceStage(
  queue: any,
  workflowId: any,
): Promise<void> {
  await prisma.$executeRaw`
    update "WorkflowInstance"
    set
      "currentStage" = ${queue},
      "updatedAt" = now()
    where id = ${workflowId}
  `;
}

export async function updateRemediationPackageStatus(
  status: any,
  packageId: any,
): Promise<void> {
  await prisma.$executeRaw`
    update "RemediationPackage"
    set
      status = ${status},
      "updatedAt" = now()
    where id = ${packageId}
  `;
}

export async function updateWorkflowQueueForPackage(
  queue: any,
  workflowId: any,
  remediationPackageId: any,
): Promise<void> {
  await prisma.$executeRaw`
    update "WorkflowQueueItem"
    set
      queue = ${queue},
      status = case
        when ${queue} = 'COMPLETE' then 'CLOSED'
        else 'OPEN'
      end,
      "workflowId" = ${workflowId},
      "updatedAt" = now()
    where payload->>'remediationPackageId' = ${remediationPackageId}
  `;
}

export async function insertRemediationActivity(
  packageId: any,
  workflowId: any,
  reviewAssignmentId: any,
  vendorId: any,
  organizationId: any,
  type: any,
  summary: any,
  actor: any,
  payloadJson: any,
): Promise<void> {
  await prisma.$executeRaw`
    insert into "RemediationActivity" (
      "packageId",
      "workflowId",
      "reviewAssignmentId",
      "vendorId",
      "organizationId",
      type,
      summary,
      actor,
      payload,
      "createdAt"
    )
    values (
      ${packageId},
      ${workflowId},
      ${reviewAssignmentId},
      ${vendorId},
      ${organizationId},
      ${type},
      ${summary},
      ${actor},
      ${payloadJson}::jsonb,
      now()
    )
  `;
}