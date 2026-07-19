import prisma from "@/lib/prisma";
import { emitWorkflowEvent } from "@/lib/workflow/workflow-events";
import { WorkflowEvent } from "@/lib/workflow/workflow-constants";

type GenerateTasksInput = {
  packageId: number;
  actor?: string;
};

function asArray(value: any): string[] {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

export async function generateWorkflowTasksForPackage(input: GenerateTasksInput) {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `
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
    where rp.id = $1
    limit 1
    `,
    input.packageId,
  );

  const pkg = rows[0];

  if (!pkg) {
    throw new Error("Remediation package not found.");
  }

  const payload = pkg.payload && typeof pkg.payload === "object" ? pkg.payload : {};
  const requiredEvidence = asArray(payload.requiredEvidence);
  const requiredAttestations = asArray(payload.requiredAttestations);

  const tasks: Array<{
    type: string;
    title: string;
    description: string;
    estimatedMinutes: number;
  }> = [];

  for (const item of requiredEvidence) {
    tasks.push({
      type: "EVIDENCE_REVIEW",
      title: `Review evidence: ${item}`,
      description: `Validate that uploaded vendor evidence satisfies: ${item}`,
      estimatedMinutes: 15,
    });
  }

  for (const item of requiredAttestations) {
    tasks.push({
      type: "ATTESTATION_REVIEW",
      title: `Review attestation: ${item}`,
      description: `Validate that the vendor provided an acceptable attestation for: ${item}`,
      estimatedMinutes: 10,
    });
  }

  tasks.push({
    type: "AI_PRE_REVIEW",
    title: "Run AI pre-review",
    description: "Classify evidence, detect gaps, and prepare reviewer recommendations.",
    estimatedMinutes: 5,
  });

  tasks.push({
    type: "PACKAGE_DECISION",
    title: "Complete package decision",
    description: "Approve, request more information, or escalate the remediation package.",
    estimatedMinutes: 10,
  });

  let created = 0;

  for (const task of tasks) {
    const existing: any[] = await prisma.$queryRawUnsafe(
      `
      select id
      from "WorkflowTask"
      where "packageId" = $1
        and type = $2
        and title = $3
      limit 1
      `,
      input.packageId,
      task.type,
      task.title,
    );

    if (existing.length > 0) continue;

    await prisma.$executeRawUnsafe(
      `
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
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN', $10, $11, $12, $13::jsonb, now(), now())
      `,
      pkg.workflowId ?? null,
      pkg.queueItemId ?? null,
      input.packageId,
      pkg.reviewAssignmentId,
      pkg.vendorId,
      pkg.organizationId,
      task.type,
      task.title,
      task.description,
      Number(pkg.severity === "HIGH" ? 85 : pkg.severity === "CRITICAL" ? 100 : 60),
      pkg.dueAt ?? null,
      task.estimatedMinutes,
      JSON.stringify({
        source: "WorkflowTaskEngine",
        packageSeverity: pkg.severity ?? null,
      }),
    );

    created++;
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
    values ($1, $2, $3, $4, 'WORKFLOW_TASKS_GENERATED', $5, $6, $7::jsonb, now())
    `,
    pkg.workflowId ?? null,
    pkg.organizationId,
    pkg.vendorId,
    pkg.reviewAssignmentId,
    input.actor ?? "WORKFLOW_TASK_ENGINE",
    `Generated ${created} workflow task(s).`,
    JSON.stringify({ packageId: input.packageId, created }),
  );

  return {
    ok: true,
    packageId: input.packageId,
    created,
    totalCandidates: tasks.length,
  };
}

export async function claimWorkflowTask(input: {
  taskId: number;
  reviewerId: string;
  reviewerName: string;
}) {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    update "WorkflowTask"
    set
      "assignedTo" = $1,
      "assignedReviewerName" = $2,
      status = case when status = 'OPEN' then 'IN_PROGRESS' else status end,
      "startedAt" = coalesce("startedAt", now()),
      "updatedAt" = now()
    where id = $3
      and status in ('OPEN', 'IN_PROGRESS')
    returning *
    `,
    input.reviewerId,
    input.reviewerName,
    input.taskId,
  );

  if (rows.length === 0) {
    throw new Error("Task not available.");
  }

  const item = rows[0];

  const packageCompletion = await maybeCompletePackageFromTasks(
    Number(item.packageId ?? 0) || null,
  );

  return {
    ...item,
    packageCompletion,
  };
}


async function maybeCompletePackageFromTasks(packageId: number | null | undefined) {
  if (!packageId) return null;

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    select
      count(*)::int as total,
      count(*) filter (where status = 'COMPLETED')::int as completed
    from "WorkflowTask"
    where "packageId" = $1
      and status <> 'CANCELLED'
    `,
    packageId,
  );

  const total = Number(rows?.[0]?.total ?? 0);
  const completed = Number(rows?.[0]?.completed ?? 0);

  if (total > 0 && completed >= total) {
    await emitWorkflowEvent({
      event: WorkflowEvent.PackageApproved,
      packageId,
      actor: "WORKFLOW_TASK_ENGINE",
      summary: "All workflow tasks completed; remediation package moved to release check.",
      payload: {
        totalTasks: total,
        completedTasks: completed,
      },
    });

    return {
      completed: true,
      totalTasks: total,
      completedTasks: completed,
    };
  }

  return {
    completed: false,
    totalTasks: total,
    completedTasks: completed,
  };
}
export async function completeWorkflowTask(input: {
  taskId: number;
  result?: string | null;
  notes?: string | null;
}) {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    update "WorkflowTask"
    set
      status = 'COMPLETED',
      result = $1,
      notes = $2,
      "completedAt" = now(),
      "updatedAt" = now()
    where id = $3
    returning *
    `,
    input.result ?? "COMPLETED",
    input.notes ?? null,
    input.taskId,
  );

  if (rows.length === 0) {
    throw new Error("Task not found.");
  }

  const item = rows[0];

  const packageCompletion = await maybeCompletePackageFromTasks(
    Number(item.packageId ?? 0) || null,
  );

  return {
    ...item,
    packageCompletion,
  };
}

