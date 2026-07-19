// lib/current-org.ts
import prisma from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

export async function getCurrentOrgId(): Promise<number | null> {
  const cu = await currentUser();
  if (!cu) return null;

  const clerkId = cu.id;
  const email = cu.primaryEmailAddress?.emailAddress;
  const name = cu.fullName ?? cu.firstName ?? cu.lastName ?? undefined;

  // If Clerk email is missing, we cannot safely map to DB without clerkId.
  if (!email) return null;

  // œ… Email-first (works immediately with your current schema + seed)
  // Keep it idempotent: ensures a User row exists and stays updated.
  const dbUser = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
    select: { id: true, organizationId: true },
  });

  // Primary org if set
  if (dbUser.organizationId) return dbUser.organizationId;

  // Fallback: first membership org
  const membership = await prisma.orgMembership.findFirst({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  // Optional: if membership exists, set primary org for future fast lookups
  if (membership?.organizationId) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { organizationId: membership.organizationId },
    });
    return membership.organizationId;
  }

  return null;
}




