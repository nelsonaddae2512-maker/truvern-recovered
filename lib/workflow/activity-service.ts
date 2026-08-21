import { insertWorkflowActivity } from "@/lib/repositories/workflow-activity-repository";

export async function recordWorkflowActivity(input: {
  packageId?: number | null;
  taskId?: number | null;
  workflowId?: number | null;
  reviewAssignmentId?: number | null;
  vendorId?: number | null;
  organizationId: number;
  type: string;
  summary: string;
  actor?: string | null;
  payload?: Record<string, any>;
}) {
  if (!input.packageId) return null;

  const rows = await insertWorkflowActivity({
    packageId: input.packageId,
    taskId: input.taskId ?? null,
    workflowId: input.workflowId ?? null,
    reviewAssignmentId: input.reviewAssignmentId ?? null,
    vendorId: input.vendorId ?? null,
    organizationId: input.organizationId,
    type: input.type,
    summary: input.summary,
    actor: input.actor ?? "SYSTEM",
    payloadJson: JSON.stringify(input.payload ?? {}),
  });

  return rows[0] ?? null;
}
