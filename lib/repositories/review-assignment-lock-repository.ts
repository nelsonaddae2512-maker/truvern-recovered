import type { Prisma } from "@prisma/client";

export async function acquireReviewAssignmentAdvisoryLock(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: number;
    vendorId: number;
  },
) {
  return tx.$executeRaw`
    select pg_advisory_xact_lock(
      ${input.organizationId}::int,
      ${input.vendorId}::int
    )
  `;
}