// lib/vendor-portal.ts
import prisma from "@/lib/prisma";

/**
 * Ensures a VendorPortalUser exists for this Clerk user.
 *
 * Dev-friendly behavior:
 * - Uses the first organization.
 * - Uses the first vendor in that organization.
 * - Creates the portal user linked to both required relations.
 */
export async function ensureVendorPortalUser(clerkUserId: string) {
  const existing = await prisma.vendorPortalUser.findUnique({
    where: { clerkUserId },
  });

  if (existing) return existing;

  const defaultOrg = await prisma.organization.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (!defaultOrg) {
    throw new Error(
      "No Organization exists. Seed an organization first before provisioning vendor portal users.",
    );
  }

  const defaultVendor = await prisma.vendor.findFirst({
    where: { organizationId: defaultOrg.id },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (!defaultVendor) {
    throw new Error(
      "No Vendor exists for the default organization. Seed a vendor first before provisioning vendor portal users.",
    );
  }

  return prisma.vendorPortalUser.create({
    data: {
      clerkUserId,
      organization: { connect: { id: defaultOrg.id } },
      vendor: { connect: { id: defaultVendor.id } },
    },
  });
}


