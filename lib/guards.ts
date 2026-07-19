// lib/guards.ts
import prisma from "@/lib/prisma";
import type { Actor } from "@/lib/actor";

export type GuardError = Error & { status?: number };

function guardError(message: string, status: number): GuardError {
  const e: GuardError = new Error(message);
  e.status = status;
  return e;
}

export function requireOrgActor(actor: Actor): number {
  if (actor.mode !== "org") throw guardError("Org access required", 403);
  return actor.orgId;
}

export function requireVendorActor(actor: Actor): number {
  if (actor.mode !== "vendor") throw guardError("Vendor access required", 403);
  return actor.vendorId;
}

/**
 * Ensures a vendor belongs to an org.
 * Returns the vendor id if allowed.
 */
export async function requireVendorInOrg(
  vendorId: number,
  orgId: number
): Promise<number> {
  if (!Number.isFinite(vendorId) || vendorId <= 0) throw guardError("Invalid vendorId", 400);

  const v = await prisma.vendor.findFirst({
    where: { id: vendorId, organizationId: orgId },
    select: { id: true },
  });

  if (!v) throw guardError("Forbidden vendorId", 403);
  return v.id;
}



