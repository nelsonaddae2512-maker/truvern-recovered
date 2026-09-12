import prisma from "@/lib/prisma";

export async function readAiReviewWorkerTasks(): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      wt.id,
      wt."packageId",
      wt."workflowId",
      wt."reviewAssignmentId",
      ra."assignmentType"::text as "assignmentType",
      wt."vendorId",
      wt."organizationId",
      wt.title,
      wt.payload,
      rp.title as "packageTitle",
      rp.payload as "packagePayload",
      rp."evidenceRequestId",
      er."fulfilledEvidenceId",
      er.title as "evidenceRequestTitle",
      er.description as "evidenceRequestDescription",
      er."vendorResponse",
      er."reviewerNotes",
      er."resolutionNotes",
      ev.id as "evidenceId",
      ev.title as "evidenceTitle",
      ev.description as "evidenceDescription",
      coalesce(ev."fileUrl", ev.url) as "evidenceStorageKey",
      ev.kind::text as "evidenceKind",
      ev."uploadedAt" as "evidenceUploadedAt",
      ev."documentDate" as "evidenceDocumentDate",
      ev."validUntil" as "evidenceValidUntil"
    from "WorkflowTask" wt
    left join "ReviewAssignment" ra
      on ra.id = wt."reviewAssignmentId"
      and ra."organizationId" = wt."organizationId"
      and ra."vendorId" = wt."vendorId"
    left join "RemediationPackage" rp on rp.id = wt."packageId"
    left join "EvidenceRequest" er
      on er.id = rp."evidenceRequestId"
      and er."vendorId" = rp."vendorId"
      and er."organizationId" = rp."organizationId"
    left join "Evidence" ev
      on ev.id = er."fulfilledEvidenceId"
      and ev."evidenceRequestId" = er.id
      and ev."vendorId" = rp."vendorId"
      and ev."organizationId" = rp."organizationId"
    where wt.type = 'AI_PRE_REVIEW'
      and wt.status in ('OPEN','IN_PROGRESS')
    order by wt.priority desc, wt."createdAt" asc
    limit 25
  `;
}

export async function readAiReviewWorkerTasksForPackage(
  packageId: number,
): Promise<any[]> {
  return prisma.$queryRaw<any[]>`
    select
      wt.id,
      wt."packageId",
      wt."workflowId",
      wt."reviewAssignmentId",
      ra."assignmentType"::text as "assignmentType",
      wt."vendorId",
      wt."organizationId",
      wt.title,
      wt.payload,
      rp.title as "packageTitle",
      rp.payload as "packagePayload",
      rp."evidenceRequestId",
      er."fulfilledEvidenceId",
      er.title as "evidenceRequestTitle",
      er.description as "evidenceRequestDescription",
      er."vendorResponse",
      er."reviewerNotes",
      er."resolutionNotes",
      ev.id as "evidenceId",
      ev.title as "evidenceTitle",
      ev.description as "evidenceDescription",
      coalesce(ev."fileUrl", ev.url) as "evidenceStorageKey",
      ev.kind::text as "evidenceKind",
      ev."uploadedAt" as "evidenceUploadedAt",
      ev."documentDate" as "evidenceDocumentDate",
      ev."validUntil" as "evidenceValidUntil"
    from "WorkflowTask" wt
    left join "ReviewAssignment" ra
      on ra.id = wt."reviewAssignmentId"
      and ra."organizationId" = wt."organizationId"
      and ra."vendorId" = wt."vendorId"
    left join "RemediationPackage" rp on rp.id = wt."packageId"
    left join "EvidenceRequest" er
      on er.id = rp."evidenceRequestId"
      and er."vendorId" = rp."vendorId"
      and er."organizationId" = rp."organizationId"
    left join "Evidence" ev
      on ev.id = er."fulfilledEvidenceId"
      and ev."evidenceRequestId" = er.id
      and ev."vendorId" = rp."vendorId"
      and ev."organizationId" = rp."organizationId"
    where wt.type = 'AI_PRE_REVIEW'
      and wt.status in ('OPEN','IN_PROGRESS')
      and wt."packageId" = ${packageId}
    order by wt.priority desc, wt."createdAt" asc
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