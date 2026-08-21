import { getGovernanceActor } from "@/lib/auth/truvern-governance";
import { insertGovernanceAuditLog } from "@/lib/repositories/governance-audit-log-repository";

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
    await insertGovernanceAuditLog({
      organizationId: input.organizationId ?? null,
      actorUserId,
      entityType: input.entityType,
      entityId: String(input.entityId),
      action: input.action,
      message: input.message ?? null,
      metadataJson: JSON.stringify(input.metadata ?? {}),
    });
  } catch {
    // Audit failures must not break governance workflows.
  }
}

