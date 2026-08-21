import prisma from "@/lib/prisma";

export async function readWorkflowEventPackageContext(
  packageId: number,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      rp.id,
      rp."reviewAssignmentId",
      rp."vendorId",
      rp."organizationId",
      rp.severity,
      rp."dueAt",
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

export async function createWorkflowForEvent(
  organizationId: number,
  vendorId: number | null,
  reviewAssignmentId: number | null,
  stage: string,
  payloadJson: string,
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
      ${stage},
      ${payloadJson}::jsonb,
      now(),
      now()
    )
    returning id
  `;
}

export async function insertWorkflowEventRecord(
  workflowId: number,
  organizationId: number,
  vendorId: number | null,
  reviewAssignmentId: number | null,
  type: string,
  actor: string,
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
      ${type},
      ${actor},
      ${summary},
      ${payloadJson}::jsonb,
      now()
    )
  `;
}

export async function updateWorkflowEventStage(
  stage: string,
  workflowId: number,
): Promise<void> {
  await prisma.$executeRaw`
    update "WorkflowInstance"
    set
      "currentStage" = ${stage},
      "updatedAt" = now()
    where id = ${workflowId}
  `;
}

export async function updateWorkflowEventPackageStatus(
  status: string,
  packageId: number,
): Promise<void> {
  await prisma.$executeRaw`
    update "RemediationPackage"
    set
      status = ${status},
      "updatedAt" = now()
    where id = ${packageId}
  `;
}