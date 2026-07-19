import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

type DbOrg = {
  id: number;
  name: string;
  slug: string;
  clerkOrgId: string | null;
};

function makeSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function uniqueOrgSlug(base: string) {
  const clean = makeSlug(base) || "workspace";

  const existing = await prisma.organization.findFirst({
    where: { slug: clean },
    select: { id: true },
  });

  if (!existing) return clean;

  return `${clean}-${Date.now().toString().slice(-6)}`;
}

export async function requireDbOrganization(): Promise<
  DbOrg | { _needsOrgSelection: true }
> {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { _needsOrgSelection: true };
  }

  if (orgId) {
    const existing = await prisma.organization.findFirst({
      where: { clerkOrgId: orgId },
      select: { id: true, name: true, slug: true, clerkOrgId: true },
    });

    if (existing) {
      return existing;
    }

    const slug = await uniqueOrgSlug(`org-${orgId}`);

    const created = await prisma.organization.create({
      data: {
        clerkOrgId: orgId,
        name: "Organization",
        slug,
      },
      select: { id: true, name: true, slug: true, clerkOrgId: true },
    });

    return created;
  }

  const personalClerkOrgId = `user:${userId}`;

  const existingPersonal = await prisma.organization.findFirst({
    where: { clerkOrgId: personalClerkOrgId },
    select: { id: true, name: true, slug: true, clerkOrgId: true },
  });

  if (existingPersonal) {
    return existingPersonal;
  }

  const user = await currentUser();

  const workspaceName =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Personal workspace";

  const slug = await uniqueOrgSlug(`workspace-${userId}`);

  const createdPersonal = await prisma.organization.create({
    data: {
      clerkOrgId: personalClerkOrgId,
      name: workspaceName,
      slug,
    },
    select: { id: true, name: true, slug: true, clerkOrgId: true },
  });

  return createdPersonal;
}

