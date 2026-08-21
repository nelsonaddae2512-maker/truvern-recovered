import prisma from "@/lib/prisma";

export async function insertGovernanceAuditLog(input: {
  organizationId?: number | null;
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  message?: string | null;
  metadataJson: string;
}) {
  return prisma.$executeRaw`
    insert into "AuditLog" (
      "organizationId",
      "actorUserId",
      "entityType",
      "entityId",
      "action",
      "message",
      "metadata",
      "createdAt"
    )
    values (
      ${input.organizationId ?? null},
      ${input.actorUserId ?? null},
      ${input.entityType},
      ${input.entityId},
      ${input.action},
      ${input.message ?? null},
      ${input.metadataJson}::jsonb,
      now()
    )
  `;
}