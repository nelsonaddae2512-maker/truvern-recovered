import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function requireDbOrganization() {
  const { orgId: clerkOrgId, userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const org = await prisma.organization.findFirst({
    where: clerkOrgId ? { clerkOrgId } : undefined,
    orderBy: { id: "asc" },
  });

  if (!org) {
    throw new Error("No organization found.");
  }

  return org;
}



