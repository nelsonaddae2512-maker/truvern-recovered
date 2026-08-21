import prisma from "@/lib/prisma";

export type WorkflowNotificationEventRow = {
  id: number;
};

export async function recordWorkflowNotificationEvent(input: {
  workflowId?: number | null;
  organizationId: number;
  vendorId?: number | null;
  reviewAssignmentId?: number | null;
  type: string;
  actor: string;
  summary: string;
  payloadJson: string;
}): Promise<WorkflowNotificationEventRow[]> {
  return prisma.$queryRaw<WorkflowNotificationEventRow[]>`
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
      ${input.workflowId ?? null},
      ${input.organizationId},
      ${input.vendorId ?? null},
      ${input.reviewAssignmentId ?? null},
      ${input.type},
      ${input.actor},
      ${input.summary},
      ${input.payloadJson}::jsonb,
      now()
    )
    returning id
  `;
}