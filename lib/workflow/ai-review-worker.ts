import prisma from "@/lib/prisma";
import { completeWorkflowTask } from "@/lib/workflow/workflow-task-engine";

export async function runAiReviewWorker() {
  const tasks: any[] = await prisma.$queryRawUnsafe(`
    select
      wt.id,
      wt."packageId",
      wt."workflowId",
      wt."reviewAssignmentId",
      wt."vendorId",
      wt."organizationId",
      wt.title,
      wt.payload,
      rp.title as "packageTitle",
      rp.payload as "packagePayload"
    from "WorkflowTask" wt
    left join "RemediationPackage" rp on rp.id = wt."packageId"
    where wt.type = 'AI_PRE_REVIEW'
      and wt.status in ('OPEN','IN_PROGRESS')
    order by wt.priority desc, wt."createdAt" asc
    limit 25
  `);

  let completed = 0;

  for (const task of tasks) {
    const packagePayload =
      task.packagePayload && typeof task.packagePayload === "object"
        ? task.packagePayload
        : {};

    const requiredEvidence = Array.isArray(packagePayload.requiredEvidence)
      ? packagePayload.requiredEvidence
      : [];

    const requiredAttestations = Array.isArray(packagePayload.requiredAttestations)
      ? packagePayload.requiredAttestations
      : [];

    const result = {
      aiReviewVersion: "TRV-AI-REVIEW-STUB-1.0",
      recommendation: "HUMAN_REVIEW_REQUIRED",
      confidence: 0.72,
      evidenceChecklistCount: requiredEvidence.length,
      attestationChecklistCount: requiredAttestations.length,
      suggestedReviewerFocus: [
        "Confirm uploaded evidence matches each required evidence item.",
        "Validate attestation ownership and authority.",
        "Check evidence freshness and relevance before approval.",
      ],
      generatedAt: new Date().toISOString(),
    };

    await prisma.$executeRawUnsafe(
      `
      update "WorkflowTask"
      set
        "assignedTo" = 'AI_WORKER',
        "assignedReviewerName" = 'Truvern AI Review Worker',
        status = 'IN_PROGRESS',
        "startedAt" = coalesce("startedAt", now()),
        payload = coalesce(payload, '{}'::jsonb) || $1::jsonb,
        "updatedAt" = now()
      where id = $2
      `,
      JSON.stringify({ aiReview: result }),
      task.id,
    );

    await completeWorkflowTask({
      taskId: Number(task.id),
      result: "AI_PRE_REVIEW_COMPLETED",
      notes: JSON.stringify(result),
    });

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
      values ($1, $2, $3, $4, 'AI_PRE_REVIEW_COMPLETED', 'AI_WORKER', 'AI pre-review task completed.', $5::jsonb, now())
      `,
      task.workflowId,
      task.organizationId,
      task.vendorId,
      task.reviewAssignmentId,
      JSON.stringify({
        taskId: task.id,
        packageId: task.packageId,
        result,
      }),
    );

    completed++;
  }

  return {
    ok: true,
    checked: tasks.length,
    completed,
  };
}
