import prisma from "@/lib/prisma";

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
  const rows: any[] = await prisma.$queryRawUnsafe(
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
    returning id
    `,
    input.workflowId ?? null,
    input.organizationId,
    input.vendorId ?? null,
    input.reviewAssignmentId ?? null,
    `NOTIFICATION_${input.event}`,
    input.recipientType,
    input.summary,
    JSON.stringify({
      ...(input.payload ?? {}),
      packageId: input.packageId ?? null,
    }),
  );

  return rows[0] ?? null;
}
