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
      and wt.status = 'OPEN'
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
      and wt.status = 'OPEN'
      and wt."packageId" = ${packageId}
    order by wt.priority desc, wt."createdAt" asc
  `;
}
export type AiReviewWorkerLease = {
  taskId: number;
  token: string;
  expiresAt: Date;
};

export async function claimAiReviewWorkerTaskLease(
  taskId: number,
  token: string,
  leaseSeconds = 300,
): Promise<AiReviewWorkerLease | null> {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new Error("AI_REVIEW_CLAIM_TASK_ID_INVALID");
  }

  const normalizedToken = token.trim();

  if (!normalizedToken) {
    throw new Error("AI review worker ownership token is required.");
  }

  if (
    !Number.isInteger(leaseSeconds) ||
    leaseSeconds < 60 ||
    leaseSeconds > 3600
  ) {
    throw new Error(
      "AI review worker diagnostic lease must be between 60 and 3600 seconds.",
    );
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: number;
      leaseExpiresAt: Date;
    }>
  >`
    update "WorkflowTask"
    set
      "assignedTo" = 'AI_WORKER',
      "assignedReviewerName" = 'Truvern AI remediation worker',
      status = 'IN_PROGRESS',
      "startedAt" = coalesce("startedAt", now()),
      payload =
        coalesce(payload, '{}'::jsonb) ||
        jsonb_build_object(
          'aiReviewLease',
          jsonb_build_object(
            'token', ${normalizedToken},
            'claimedAt', now(),
            'expiresAt',
              now() + (${leaseSeconds} * interval '1 second')
          )
        ),
      "updatedAt" = now()
    where id = ${taskId}
      and type = 'AI_PRE_REVIEW'
      and status = 'OPEN'
      and "assignedTo" is null
      and coalesce(payload #>> '{aiReviewLease,token}', '') = ''
    returning
      id,
      (
        payload #>> '{aiReviewLease,expiresAt}'
      )::timestamptz as "leaseExpiresAt"
  `;

  const claimed = rows[0];

  if (!claimed) {
    return null;
  }

  return {
    taskId: claimed.id,
    token: normalizedToken,
    expiresAt: claimed.leaseExpiresAt,
  };
}

export async function aiReviewWorkerLeaseIsOwned(
  taskId: number,
  token: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<
    Array<{ owned: boolean }>
  >`
    select exists (
      select 1
      from "WorkflowTask"
      where id = ${taskId}
        and type = 'AI_PRE_REVIEW'
        and status = 'IN_PROGRESS'
        and "assignedTo" = 'AI_WORKER'
        and payload #>> '{aiReviewLease,token}' = ${token}
    ) as owned
  `;

  return rows[0]?.owned === true;
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

export async function finalizeOwnedAiReviewWorkerTask(
  taskId: number,
  token: string,
  resultJson: string,
): Promise<boolean> {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new Error("AI_REVIEW_FINALIZE_TASK_ID_INVALID");
  }

  const normalizedToken = token.trim();

  if (!normalizedToken) {
    throw new Error("AI_REVIEW_FINALIZE_TOKEN_REQUIRED");
  }

  let parsedResult: unknown;

  try {
    parsedResult = JSON.parse(resultJson);
  } catch {
    throw new Error("AI_REVIEW_FINALIZE_RESULT_JSON_INVALID");
  }

  const canonicalResultJson = JSON.stringify(parsedResult);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      id: number;
      workflowId: number | null;
      organizationId: number;
      vendorId: number | null;
      reviewAssignmentId: number | null;
      packageId: number | null;
    }>>`
      update "WorkflowTask"
      set
        status = 'COMPLETED',
        result = 'AI_PRE_REVIEW_COMPLETED',
        notes = ${canonicalResultJson},
        payload =
          (
            (
              coalesce(payload, '{}'::jsonb)
              || jsonb_build_object(
                'aiReview',
                ${canonicalResultJson}::jsonb
              )
            )
            - 'aiReviewLease'
          ),
        "completedAt" = now(),
        "updatedAt" = now()
      where id = ${taskId}
        and type = 'AI_PRE_REVIEW'
        and status = 'IN_PROGRESS'
        and "assignedTo" = 'AI_WORKER'
        and coalesce(payload #>> '{aiReviewLease,token}', '') =
            ${normalizedToken}
      returning
        id,
        "workflowId",
        "organizationId",
        "vendorId",
        "reviewAssignmentId",
        "packageId"
    `;

    if (rows.length === 0) {
      return false;
    }

    if (rows.length !== 1) {
      throw new Error("AI_REVIEW_FINALIZE_CARDINALITY_INVALID");
    }

    const task = rows[0];

    await tx.$executeRaw`
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
        ${task.workflowId},
        ${task.organizationId},
        ${task.vendorId},
        ${task.reviewAssignmentId},
        'AI_PRE_REVIEW_COMPLETED',
        'AI_WORKER',
        'AI pre-review completed',
        jsonb_build_object(
          'taskId',
          ${task.id},
          'packageId',
          ${task.packageId},
          'result',
          ${canonicalResultJson}::jsonb
        ),
        now()
      )
    `;

    return true;
  });
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
export type AiReviewRecoveryQuarantineResult = {
  taskId: number;
  packageId: number | null;
  workflowId: number | null;
  organizationId: number;
  vendorId: number | null;
  reviewAssignmentId: number | null;
  quarantinedAt: string;
};

export async function quarantineExpiredAiReviewWorkerLease(
  taskId: number,
  actorUserId: string,
): Promise<AiReviewRecoveryQuarantineResult | null> {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new Error("AI_REVIEW_RECOVERY_TASK_ID_INVALID");
  }

  const normalizedActorUserId = actorUserId.trim();

  if (!normalizedActorUserId) {
    throw new Error("AI_REVIEW_RECOVERY_ACTOR_REQUIRED");
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      id: number;
      workflowId: number | null;
      organizationId: number;
      vendorId: number | null;
      reviewAssignmentId: number | null;
      packageId: number | null;
      quarantinedAt: Date;
    }>>`
      update "WorkflowTask"
      set
        "assignedTo" = 'TRUVERN_AI_RECOVERY',
        "assignedReviewerName" = 'Truvern AI Recovery',
        payload =
          coalesce(payload, '{}'::jsonb)
          || jsonb_build_object(
            'aiReviewRecovery',
            jsonb_build_object(
              'state',
              'UNCERTAIN_EXTERNAL_SIDE_EFFECT',
              'quarantinedAt',
              now(),
              'quarantinedBy',
              ${normalizedActorUserId},
              'reason',
              'EXPIRED_AI_WORKER_LEASE'
            )
          ),
        "updatedAt" = now()
      where id = ${taskId}
        and type = 'AI_PRE_REVIEW'
        and status = 'IN_PROGRESS'
        and "assignedTo" = 'AI_WORKER'
        and coalesce(payload #>> '{aiReviewLease,token}', '') <> ''
        and case
          when coalesce(payload #>> '{aiReviewLease,expiresAt}', '')
            ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
          then (payload #>> '{aiReviewLease,expiresAt}')::timestamptz <= now()
          else false
        end
        and coalesce(payload #>> '{aiReviewRecovery,state}', '') = ''
      returning
        id,
        "workflowId",
        "organizationId",
        "vendorId",
        "reviewAssignmentId",
        "packageId",
        "updatedAt" as "quarantinedAt"
    `;

    if (rows.length === 0) {
      return null;
    }

    if (rows.length !== 1) {
      throw new Error("AI_REVIEW_RECOVERY_CARDINALITY_INVALID");
    }

    const task = rows[0];

    await tx.$executeRaw`
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
        ${task.workflowId},
        ${task.organizationId},
        ${task.vendorId},
        ${task.reviewAssignmentId},
        'AI_PRE_REVIEW_RECOVERY_QUARANTINED',
        ${normalizedActorUserId},
        'Expired AI pre-review lease quarantined for manual recovery.',
        jsonb_build_object(
          'taskId',
          ${task.id},
          'packageId',
          ${task.packageId},
          'state',
          'UNCERTAIN_EXTERNAL_SIDE_EFFECT',
          'reason',
          'EXPIRED_AI_WORKER_LEASE'
        ),
        now()
      )
    `;

    return {
      taskId: task.id,
      packageId: task.packageId,
      workflowId: task.workflowId,
      organizationId: task.organizationId,
      vendorId: task.vendorId,
      reviewAssignmentId: task.reviewAssignmentId,
      quarantinedAt: task.quarantinedAt.toISOString(),
    };
  });
}
export type AiReviewRecoveryResolutionResult = {
  taskId: number;
  packageId: number | null;
  workflowId: number | null;
  organizationId: number;
  vendorId: number | null;
  reviewAssignmentId: number | null;
  resolvedAt: string;
};

export async function resolveQuarantinedAiReviewWorkerTaskWithoutAiResult(
  taskId: number,
  actorUserId: string,
  resolutionReason: string,
): Promise<AiReviewRecoveryResolutionResult | null> {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new Error("AI_REVIEW_RECOVERY_RESOLUTION_TASK_ID_INVALID");
  }

  const normalizedActorUserId = actorUserId.trim();
  const normalizedResolutionReason = resolutionReason.trim();

  if (!normalizedActorUserId) {
    throw new Error("AI_REVIEW_RECOVERY_RESOLUTION_ACTOR_REQUIRED");
  }

  if (!normalizedResolutionReason) {
    throw new Error("AI_REVIEW_RECOVERY_RESOLUTION_REASON_REQUIRED");
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      id: number;
      workflowId: number | null;
      organizationId: number;
      vendorId: number | null;
      reviewAssignmentId: number | null;
      packageId: number | null;
      resolvedAt: Date;
    }>>`
      update "WorkflowTask"
      set
        status = 'COMPLETED',
        result = 'AI_PRE_REVIEW_RECOVERY_RESOLVED_WITHOUT_AI_RESULT',
        payload =
          jsonb_set(
            coalesce(payload, '{}'::jsonb),
            '{aiReviewRecovery}',
            coalesce(payload -> 'aiReviewRecovery', '{}'::jsonb)
              || jsonb_build_object(
                'state',
                'RESOLVED_WITHOUT_AI_RESULT',
                'resolvedAt',
                now(),
                'resolvedBy',
                ${normalizedActorUserId},
                'resolutionReason',
                ${normalizedResolutionReason}
              ),
            true
          ),
        "completedAt" = now(),
        "updatedAt" = now()
      where id = ${taskId}
        and type = 'AI_PRE_REVIEW'
        and status = 'IN_PROGRESS'
        and "assignedTo" = 'TRUVERN_AI_RECOVERY'
        and coalesce(
          payload #>> '{aiReviewRecovery,state}',
          ''
        ) = 'UNCERTAIN_EXTERNAL_SIDE_EFFECT'
        and coalesce(
          payload #>> '{aiReviewLease,token}',
          ''
        ) <> ''
      returning
        id,
        "workflowId",
        "organizationId",
        "vendorId",
        "reviewAssignmentId",
        "packageId",
        "updatedAt" as "resolvedAt"
    `;

    if (rows.length === 0) {
      return null;
    }

    if (rows.length !== 1) {
      throw new Error(
        "AI_REVIEW_RECOVERY_RESOLUTION_CARDINALITY_INVALID",
      );
    }

    const task = rows[0];

    await tx.$executeRaw`
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
        ${task.workflowId},
        ${task.organizationId},
        ${task.vendorId},
        ${task.reviewAssignmentId},
        'AI_PRE_REVIEW_RECOVERY_RESOLVED',
        ${normalizedActorUserId},
        'Uncertain AI pre-review recovery resolved without asserting an AI result.',
        jsonb_build_object(
          'taskId',
          ${task.id},
          'packageId',
          ${task.packageId},
          'state',
          'RESOLVED_WITHOUT_AI_RESULT',
          'result',
          'AI_PRE_REVIEW_RECOVERY_RESOLVED_WITHOUT_AI_RESULT',
          'resolutionReason',
          ${normalizedResolutionReason}
        ),
        now()
      )
    `;

    return {
      taskId: task.id,
      packageId: task.packageId,
      workflowId: task.workflowId,
      organizationId: task.organizationId,
      vendorId: task.vendorId,
      reviewAssignmentId: task.reviewAssignmentId,
      resolvedAt: task.resolvedAt.toISOString(),
    };
  });
}

