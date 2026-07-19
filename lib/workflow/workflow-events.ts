import prisma from "@/lib/prisma";
import {
  WorkflowEvent,
  type WorkflowEventType,
  packageStatusForEvent,
  stageForEvent,
} from "@/lib/workflow/workflow-constants";
import { upsertWorkflowQueueItem } from "@/lib/workflow/queue-manager";
import { recordWorkflowActivity } from "@/lib/workflow/activity-service";
import { recordWorkflowNotification } from "@/lib/workflow/notification-service";

type WorkflowEventInput = {
  event: WorkflowEventType;
  workflowId?: number | null;
  packageId?: number | null;
  reviewAssignmentId?: number | null;
  vendorId?: number | null;
  organizationId?: number | null;
  actor?: string | null;
  summary?: string | null;
  payload?: Record<string, any>;
};

async function resolvePackageContext(packageId?: number | null) {
  if (!packageId) return null;

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
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
    where rp.id = $1
    limit 1
    `,
    packageId,
  );

  return rows[0] ?? null;
}

async function ensureWorkflow(input: {
  workflowId?: number | null;
  organizationId: number;
  vendorId?: number | null;
  reviewAssignmentId?: number | null;
  stage: string;
}) {
  if (input.workflowId) return input.workflowId;

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
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
    values ($1, $2, $3, 'VENDOR_GOVERNANCE_REVIEW', 'ACTIVE', 'NORMAL', $4, $5::jsonb, now(), now())
    returning id
    `,
    input.organizationId,
    input.vendorId ?? null,
    input.reviewAssignmentId ?? null,
    input.stage,
    JSON.stringify({ createdBy: "WorkflowEventDispatcher" }),
  );

  return Number(rows[0].id);
}

export async function emitWorkflowEvent(input: WorkflowEventInput) {
  const context = await resolvePackageContext(input.packageId);
  const stage = stageForEvent(input.event);
  const packageStatus = packageStatusForEvent(input.event);

  const organizationId = input.organizationId ?? context?.organizationId ?? null;
  const vendorId = input.vendorId ?? context?.vendorId ?? null;
  const reviewAssignmentId = input.reviewAssignmentId ?? context?.reviewAssignmentId ?? null;

  if (!organizationId) {
    throw new Error("organizationId is required to emit workflow event.");
  }

  const workflowId = await ensureWorkflow({
    workflowId: input.workflowId ?? context?.workflowId ?? null,
    organizationId,
    vendorId,
    reviewAssignmentId,
    stage,
  });

  const summary =
    input.summary ??
    input.event
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/^\w/, (letter) => letter.toUpperCase());

  await prisma.$executeRawUnsafe(
    `
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
    values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
    `,
    workflowId,
    organizationId,
    vendorId,
    reviewAssignmentId,
    input.event,
    input.actor ?? "SYSTEM",
    summary,
    JSON.stringify(input.payload ?? {}),
  );

  await prisma.$executeRawUnsafe(
    `
    update "WorkflowInstance"
    set "currentStage" = $1, "updatedAt" = now()
    where id = $2
    `,
    stage,
    workflowId,
  );

  if (input.packageId && packageStatus) {
    await prisma.$executeRawUnsafe(
      `
      update "RemediationPackage"
      set status = $1, "updatedAt" = now()
      where id = $2
      `,
      packageStatus,
      input.packageId,
    );
  }

  await upsertWorkflowQueueItem({
    workflowId,
    packageId: input.packageId ?? null,
    reviewAssignmentId,
    vendorId,
    organizationId,
    queue: stage,
    dueAt: context?.dueAt ?? null,
    severity: context?.severity ?? null,
    payload: {
      event: input.event,
      ...(input.payload ?? {}),
    },
  });

  await recordWorkflowActivity({
    packageId: input.packageId ?? null,
    workflowId,
    reviewAssignmentId,
    vendorId,
    organizationId,
    type: input.event,
    summary,
    actor: input.actor ?? "SYSTEM",
    payload: input.payload ?? {},
  });

  if (
    input.event === WorkflowEvent.EvidenceUploaded ||
    input.event === WorkflowEvent.PackageSubmitted
  ) {
    await recordWorkflowNotification({
      workflowId,
      packageId: input.packageId ?? null,
      organizationId,
      vendorId,
      reviewAssignmentId,
      event: input.event,
      recipientType: "TRUVERN",
      summary: "Vendor evidence is waiting for Truvern review.",
      payload: input.payload ?? {},
    });
  }

  if (input.event === WorkflowEvent.MoreInformationRequested) {
    await recordWorkflowNotification({
      workflowId,
      packageId: input.packageId ?? null,
      organizationId,
      vendorId,
      reviewAssignmentId,
      event: input.event,
      recipientType: "VENDOR",
      summary: "Truvern requested more information.",
      payload: input.payload ?? {},
    });
  }

  return {
    ok: true,
    workflowId,
    stage,
    packageStatus,
  };
}
