import prisma from "@/lib/prisma";

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

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
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
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now())
    returning id
    `,
    input.packageId,
    input.taskId ?? null,
    input.workflowId ?? null,
    input.reviewAssignmentId ?? null,
    input.vendorId ?? null,
    input.organizationId,
    input.type,
    input.summary,
    input.actor ?? "SYSTEM",
    JSON.stringify(input.payload ?? {}),
  );

  return rows[0] ?? null;
}
