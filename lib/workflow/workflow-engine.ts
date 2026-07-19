import prisma from "@/lib/prisma";

export type WorkflowEventType =
  | "EVIDENCE_UPLOADED"
  | "PACKAGE_SUBMITTED"
  | "REVIEW_STARTED"
  | "PACKAGE_APPROVED"
  | "MORE_INFORMATION_REQUESTED"
  | "PACKAGE_COMPLETED"
  | "ASSESSMENT_RELEASED";

type TransitionInput = {
  workflowId?: number | null;
  packageId?: number | null;
  reviewAssignmentId?: number | null;
  vendorId?: number | null;
  organizationId?: number | null;
  event: WorkflowEventType;
  actor?: string | null;
  summary?: string | null;
  payload?: Record<string, any>;
};

function queueForEvent(event: WorkflowEventType) {
  switch (event) {
    case "EVIDENCE_UPLOADED":
    case "PACKAGE_SUBMITTED":
      return "EVIDENCE_WAITING_REVIEW";

    case "REVIEW_STARTED":
      return "UNDER_TRUVERN_REVIEW";

    case "MORE_INFORMATION_REQUESTED":
      return "VENDOR_WAITING_RESPONSE";

    case "PACKAGE_APPROVED":
    case "PACKAGE_COMPLETED":
      return "READY_FOR_RELEASE_CHECK";

    case "ASSESSMENT_RELEASED":
      return "COMPLETE";

    default:
      return "VENDOR_WAITING_RESPONSE";
  }
}

function packageStatusForEvent(event: WorkflowEventType) {
  switch (event) {
    case "EVIDENCE_UPLOADED":
    case "PACKAGE_SUBMITTED":
      return "SUBMITTED";

    case "REVIEW_STARTED":
      return "IN_REVIEW";

    case "MORE_INFORMATION_REQUESTED":
      return "NEEDS_MORE";

    case "PACKAGE_APPROVED":
      return "APPROVED";

    case "PACKAGE_COMPLETED":
      return "COMPLETED";

    default:
      return null;
  }
}

export async function workflowTransition(input: TransitionInput) {
  const payload = input.payload ?? {};

  const packageRows: any[] = input.packageId
    ? await prisma.$queryRawUnsafe(
        `
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
        where rp.id = $1
        limit 1
        `,
        input.packageId,
      )
    : [];

  const pkg = packageRows[0] ?? null;

  const workflowId = input.workflowId ?? pkg?.workflowId ?? null;
  const reviewAssignmentId = input.reviewAssignmentId ?? pkg?.reviewAssignmentId ?? null;
  const vendorId = input.vendorId ?? pkg?.vendorId ?? null;
  const organizationId = input.organizationId ?? pkg?.organizationId ?? null;
  const queue = queueForEvent(input.event);
  const packageStatus = packageStatusForEvent(input.event);
  const summary = input.summary ?? input.event.replaceAll("_", " ").toLowerCase();

  if (!organizationId) {
    throw new Error("organizationId is required for workflow transition.");
  }

  let finalWorkflowId = workflowId;

  if (!finalWorkflowId) {
    const created: any[] = await prisma.$queryRawUnsafe(
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
      values (
        $1,
        $2,
        $3,
        'VENDOR_GOVERNANCE_REVIEW',
        'ACTIVE',
        'NORMAL',
        $4,
        $5::jsonb,
        now(),
        now()
      )
      returning id
      `,
      organizationId,
      vendorId,
      reviewAssignmentId,
      queue,
      JSON.stringify({ createdBy: "WorkflowEngine" }),
    );

    finalWorkflowId = Number(created[0].id);
  }

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
    finalWorkflowId,
    organizationId,
    vendorId,
    reviewAssignmentId,
    input.event,
    input.actor ?? "SYSTEM",
    summary,
    JSON.stringify(payload),
  );

  await prisma.$executeRawUnsafe(
    `
    update "WorkflowInstance"
    set
      "currentStage" = $1,
      "updatedAt" = now()
    where id = $2
    `,
    queue,
    finalWorkflowId,
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

  if (input.packageId) {
    await prisma.$executeRawUnsafe(
      `
      update "WorkflowQueueItem"
      set
        queue = $1,
        status = case when $1 = 'COMPLETE' then 'CLOSED' else 'OPEN' end,
        "workflowId" = $2,
        "updatedAt" = now()
      where payload->>'remediationPackageId' = $3
      `,
      queue,
      finalWorkflowId,
      String(input.packageId),
    );

    await prisma.$executeRawUnsafe(
      `
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
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
      `,
      input.packageId,
      finalWorkflowId,
      reviewAssignmentId,
      vendorId,
      organizationId,
      input.event,
      summary,
      input.actor ?? "SYSTEM",
      JSON.stringify(payload),
    );
  }

  return {
    ok: true,
    workflowId: finalWorkflowId,
    queue,
    packageStatus,
  };
}
