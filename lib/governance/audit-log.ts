import prisma from "@/lib/prisma";
import { getGovernanceActor } from "@/lib/auth/truvern-governance";

type AuditInput = {
  organizationId?: number | null;
  entityType: string;
  entityId: string | number;
  action: string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function writeGovernanceAuditLog(input: AuditInput) {
  let actorUserId: string | null = null;

  try {
    const actor = await getGovernanceActor();
    actorUserId = actor.userId;
  } catch {
    // Allow audit logging to remain non-blocking.
  }

  try {
    await prisma.$executeRawUnsafe(
      `
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
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
      `,
      input.organizationId ?? null,
      actorUserId,
      input.entityType,
      String(input.entityId),
      input.action,
      input.message ?? null,
      JSON.stringify(input.metadata ?? {}),
    );
  } catch {
    // Audit failures must not break governance workflows.
  }
}

