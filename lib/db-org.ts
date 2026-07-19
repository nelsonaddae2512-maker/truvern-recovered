// lib/db-org.ts
import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";

const DEV = process.env.NODE_ENV !== "production";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function ensureDbUser(clerkUserId: string) {
  // Your schema uses User.clerkId (String? @unique)
  let dbUser = await prisma.user.findFirst({
    where: { clerkId: clerkUserId },
  });
  if (dbUser) return dbUser;

  // Create from Clerk profile (best effort)
  const u = await currentUser().catch(() => null);

  const clerkEmail =
    (u?.emailAddresses?.[0]?.emailAddress as string | undefined) || "";
  const email = clerkEmail.trim().length
    ? clerkEmail.trim()
    : `dev+${clerkUserId}@local`;

  const fullName =
    ((u?.fullName as string | undefined) || "").trim() ||
    ([u?.firstName, u?.lastName].filter(Boolean).join(" ") as string).trim();

  const name = fullName.length ? fullName : null;

  // email is required + unique in schema; make it deterministic in dev
  // If the Clerk email already exists in DB under a different user, we'll fall back to a local email.
  try {
    dbUser = await prisma.user.create({
      data: {
        email,
        name,
        clerkId: clerkUserId,
      },
    });
    return dbUser;
  } catch {
    // fallback unique email
    dbUser = await prisma.user.create({
      data: {
        email: `dev+${clerkUserId}@local`,
        name: name || "Dev User",
        clerkId: clerkUserId,
      },
    });
    return dbUser;
  }
}

async function ensureDevOrgAndMembership(dbUserId: number) {
  // Ensure at least one org exists
  let org = await prisma.organization.findFirst({ orderBy: { id: "asc" } });

  if (!org) {
    const baseName = "Truvern Demo Org";
    let baseSlug = slugify(baseName) || "truvern-demo";
    let slug = baseSlug;

    // slug must be unique; ensure it is
    for (let i = 0; i < 50; i++) {
      const exists = await prisma.organization.findFirst({ where: { slug } });
      if (!exists) break;
      slug = `${baseSlug}-${i + 2}`;
    }

    org = await prisma.organization.create({
      data: {
        name: baseName,
        slug,
      },
    });
  }

  // Ensure membership exists
  await prisma.orgMembership.upsert({
    where: {
      userId_organizationId: { userId: dbUserId, organizationId: org.id },
    },
    update: {},
    create: {
      userId: dbUserId,
      organizationId: org.id,
      role: "OWNER",
    },
  });

  // Optionally set User.organizationId as "primary org"
  await prisma.user.update({
    where: { id: dbUserId },
    data: { organizationId: org.id },
  });

  return org;
}

export async function getDbOrg() {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  // Always ensure we can map Clerk user -> DB user (User.clerkId)
  const dbUser = await ensureDbUser(userId);

  // 1) If Clerk org is selected, resolve Organization by clerkOrgId
  if (orgId) {
    const org = await prisma.organization.findFirst({
      where: { clerkOrgId: orgId },
    });
    if (org) {
      // Ensure membership exists for this user+org
      await prisma.orgMembership.upsert({
        where: {
          userId_organizationId: { userId: dbUser.id, organizationId: org.id },
        },
        update: {},
        create: {
          userId: dbUser.id,
          organizationId: org.id,
          role: "ADMIN",
        },
      });

      // Keep primary org pointer up to date
      if (dbUser.organizationId !== org.id) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { organizationId: org.id },
        });
      }

      return org;
    }
  }

  // 2) Use primary organizationId if set
  if (dbUser.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: dbUser.organizationId },
    });
    if (org) return org;
  }

  // 3) Fall back to first membership
  const membership = await prisma.orgMembership.findFirst({
    where: { userId: dbUser.id },
    include: { organization: true },
    orderBy: { id: "asc" },
  });
  if (membership?.organization) return membership.organization;

  // 4) DEV bootstrap if nothing exists
  if (DEV) {
    return ensureDevOrgAndMembership(dbUser.id);
  }

  return null;
}




