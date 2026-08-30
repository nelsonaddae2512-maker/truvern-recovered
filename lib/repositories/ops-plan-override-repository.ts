import type { Prisma } from "@prisma/client";

export type OpsPlanOverrideOrganizationRow = {
  id: number;
  name: string;
  planTier: string;
};

export async function readOrganizationForPlanOverride(
  tx: Prisma.TransactionClient,
  organizationId: number,
): Promise<OpsPlanOverrideOrganizationRow[]> {
  return tx.$queryRaw<OpsPlanOverrideOrganizationRow[]>`
    select
      id,
      name,
      "planTier"::text as "planTier"
    from "Organization"
    where id = ${organizationId}
    limit 1
  `;
}

export async function updateOrganizationPlanTier(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: number;
    nextTier: string;
  },
) {
  return tx.$executeRaw`
    update "Organization"
    set
      "planTier" = ${input.nextTier}::"PlanTier",
      "billingUpdatedAt" = now(),
      "updatedAt" = now()
    where id = ${input.organizationId}
  `;
}

export async function insertPlanOverrideLedgerEntry(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: number;
    actorUserId: string | null;
    eventKey: string;
    note: string;
    metadataJson: string;
  },
) {
  return tx.$executeRaw`
    insert into "TruvernCreditLedgerEntry" (
      "organizationId",
      "reviewAssignmentId",
      "eventKey",
      "entryType",
      "fundingSource",
      status,
      "availableDelta",
      "reservedDelta",
      "consumedDelta",
      quantity,
      note,
      "metadataJson",
      "createdAt"
    )
    values (
      ${input.organizationId},
      null,
      ${input.eventKey},
      'ADJUSTMENT'::text,
      'MANUAL'::text,
      'POSTED'::text,
      0,
      0,
      0,
      0,
      ${input.note},
      ${input.metadataJson}::jsonb,
      now()
    )
  `;
}