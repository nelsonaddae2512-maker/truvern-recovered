// lib/orgContext.ts
import prisma from "./prisma";

export type OrgContext = {
  orgId: number;
  orgSlug: string;
};

export async function getOrgContext(): Promise<OrgContext> {
  const org = await prisma.organization.findFirst();
  if (!org) {
    throw new Error("No organization found for OrgContext");
  }
  return {
    orgId: org.id,
    orgSlug: (org as any).slug ?? "primary",
  };
}



