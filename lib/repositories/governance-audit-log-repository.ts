import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type GovernanceAuditLogClient = Pick<Prisma.TransactionClient, "$executeRaw">;

export async function insertGovernanceAuditLog(
  input: {
    organizationId?: number | null;
    actorUserId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    message?: string | null;
    metadataJson: string;
  },
  client: GovernanceAuditLogClient = prisma,
) {
  return client.$executeRaw`
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
