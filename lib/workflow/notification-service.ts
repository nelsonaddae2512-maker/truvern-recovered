import { recordWorkflowNotificationEvent } from "@/lib/repositories/workflow-notification-repository";

export async function recordWorkflowNotification(input: {
  workflowId?: number | null;
  packageId?: number | null;
  organizationId: number;
  vendorId?: number | null;
  reviewAssignmentId?: number | null;
  event: string;
  recipientType: "VENDOR" | "TRUVERN" | "CUSTOMER" | "SYSTEM";
  summary: string;
  payload?: Record<string, any>;
}) {
  // Lightweight notification stub for now:
  // record as WorkflowEvent with NOTIFICATION_* type.
  const notificationType = `NOTIFICATION_${input.event}`;

  const rows = await recordWorkflowNotificationEvent({
    workflowId: input.workflowId ?? null,
    organizationId: input.organizationId,
    vendorId: input.vendorId ?? null,
    reviewAssignmentId: input.reviewAssignmentId ?? null,
    type: notificationType,
    actor: input.recipientType,
    summary: input.summary,
    payloadJson: JSON.stringify({
      ...(input.payload ?? {}),
      packageId: input.packageId ?? null,
    }),
  });

  return rows[0] ?? null;
}
