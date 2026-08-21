import prisma from "@/lib/prisma";

export type WorkflowActivityInsertRow = {
  id: number;
};

export async function insertWorkflowActivity(input: {
  packageId: number;
  taskId?: number | null;
  workflowId?: number | null;
  reviewAssignmentId?: number | null;
  vendorId?: number | null;
  organizationId: number;
  type: string;
  summary: string;
  actor: string;
  payloadJson: string;
}): Promise<WorkflowActivityInsertRow[]> {
  return prisma.$queryRaw<WorkflowActivityInsertRow[]>`
    insert into "RemediationActivity" (
      "packageId",
      "taskId",
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
      ${input.packageId},
      ${input.taskId ?? null},
      ${input.workflowId ?? null},
      ${input.reviewAssignmentId ?? null},
      ${input.vendorId ?? null},
      ${input.organizationId},
      ${input.type},
      ${input.summary},
      ${input.actor},
      ${input.payloadJson}::jsonb,
      now()
    )
    returning id
  `;
}