import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import {
  readGovernanceDbUserId,
} from "@/lib/repositories/governance-auth-repository";
import { getCurrentTruvernAccess } from "@/lib/truvern-ops-access";

const ONBOARDING_URL =
  "/select-org?returnTo=%2Fdashboard";

const COMPLETION_URL =
  "/select-org/complete?returnTo=%2Fdashboard";

export async function requireDashboardOrganizationAccess() {
  const session = await auth();

  if (!session.userId) {
    redirect("/sign-in?redirect_url=%2Fdashboard");
  }

  const truvernAccess =
    await getCurrentTruvernAccess();

  const configuredOpsUsers = new Set(
    (process.env.TRUVERN_OPS_USERS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (
    configuredOpsUsers.has(session.userId) ||
    truvernAccess.isTruvernOperator
  ) {
    return;
  }

  if (!session.orgId) {
    redirect(ONBOARDING_URL);
  }

  const organization =
    await prisma.organization.findUnique({
      where: {
        clerkOrgId: session.orgId,
      },
      select: {
        id: true,
      },
    });

  if (!organization) {
    redirect(COMPLETION_URL);
  }

  const existingUsers =
    await readGovernanceDbUserId(
      session.userId,
    );

  const dbUserId =
    existingUsers[0]?.id ?? null;

  if (!dbUserId) {
    redirect(COMPLETION_URL);
  }

  const membership =
    await prisma.orgMembership.findFirst({
      where: {
        userId: dbUserId,
        organizationId: organization.id,
        role: {
          in: [
            "OWNER",
            "ADMIN",
            "ANALYST",
            "VIEWER",
          ],
        },
      },
      select: {
        id: true,
      },
    });

  if (!membership) {
    redirect(COMPLETION_URL);
  }
}