// lib/db-org.ts
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

function devBypassOrgEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.TRUVERN_DEV_BYPASS_ORG === "1"
  );
}

export async function getDbOrg() {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  // 1) If Clerk org is selected, try resolve by clerkOrgId on membership or organization
  if (orgId) {
    // Try membership mapping (field names vary across builds; we attempt both common patterns)
    try {
      const m1 = await (prisma as any).orgMembership.findFirst?.({
        where: { clerkOrgId: orgId, clerkUserId: userId },
        include: { organization: true },
      });
      if (m1?.organization) return m1.organization;
    } catch {}

    try {
      const m2 = await (prisma as any).orgMembership.findFirst?.({
        where: { clerkOrganizationId: orgId, clerkUserId: userId },
        include: { organization: true },
      });
      if (m2?.organization) return m2.organization;
    } catch {}

    try {
      const m3 = await (prisma as any).orgMembership.findFirst?.({
        where: { clerkOrgId: orgId, userId: userId },
        include: { organization: true },
      });
      if (m3?.organization) return m3.organization;
    } catch {}

    // Try organization table direct mapping
    try {
      const orgRow =
        (await (prisma as any).organization.findFirst?.({
          where: { clerkOrgId: orgId },
        })) ||
        (await (prisma as any).organization.findFirst?.({
          where: { clerkOrganizationId: orgId },
        }));
      if (orgRow) return orgRow;
    } catch {}
  }

  // 2) Fallback: resolve by user -> memberships
  // Common Truvern pattern: User has clerkUserId and OrgMembership links by userId (int)
  try {
    const dbUser = await (prisma as any).user.findFirst?.({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (dbUser?.id) {
      const membership = await (prisma as any).orgMembership.findFirst?.({
        where: { userId: dbUser.id },
        include: { organization: true },
        orderBy: { id: "asc" },
      });
      if (membership?.organization) return membership.organization;
    }
  } catch {}

  // 3) Dev-only bypass (lets you keep building even before membership wiring is finished)
  if (devBypassOrgEnabled()) {
    const forcedId = Number(process.env.TRUVERN_DEV_ORG_ID ?? "");
    if (Number.isFinite(forcedId)) {
      const forced = await prisma.organization.findUnique({
        where: { id: forcedId },
      });
      if (forced) return forced;
    }

    // If no forced ID, just pick the first org in DB (DEV ONLY)
    const first = await prisma.organization.findFirst({
      orderBy: { id: "asc" },
    });
    if (first) return first;
  }

  return null;
}




