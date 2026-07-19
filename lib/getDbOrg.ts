import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export type DbOrg = {
  id: number;
  name?: string | null;
};

async function safeFindOrganization(where: any) {
  try {
    return await prisma.organization.findFirst({
      where,
      select: { id: true, name: true } as any,
    });
  } catch {
    return null;
  }
}

// Resolve active Clerk orgId -> DB Organization row (or null)
export async function getDbOrg(): Promise<DbOrg | null> {
  const { userId, orgId, orgSlug } = await auth();

  if (!userId) return null;
  if (!orgId) return null;

  // Try common schema field names without assuming yours
  let org =
    (await safeFindOrganization({ clerkOrgId: orgId })) ||
    (await safeFindOrganization({ clerkOrganizationId: orgId })) ||
    (await safeFindOrganization({ clerk_org_id: orgId })) ||
    null;

  // Fallback: slug match (if your DB stores slug)
  if (!org && orgSlug) {
    org =
      (await safeFindOrganization({ slug: orgSlug })) ||
      (await safeFindOrganization({ orgSlug })) ||
      null;
  }

  // Fallback: membership join table (if it exists)
  if (!org) {
    try {
      const m = await (prisma as any).orgMembership?.findFirst?.({
        where: { clerkOrgId: orgId, clerkUserId: userId },
        select: { organizationId: true },
      });

      if (m?.organizationId) {
        org = await prisma.organization.findFirst({
          where: { id: m.organizationId },
          select: { id: true, name: true } as any,
        });
      }
    } catch {
      // ignore
    }
  }

  return org ? ({ id: (org as any).id, name: (org as any).name } as DbOrg) : null;
}

// Require DB org or redirect to org-select (prevents infinite "Rendering...")
export async function requireDbOrg(): Promise<DbOrg> {
  const org = await getDbOrg();
  if (!org) redirect("/org-select");
  return org;
}




