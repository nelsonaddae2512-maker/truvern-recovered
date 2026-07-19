import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { governanceForbidden, governanceUnauthorized } from "@/lib/auth/governance-auth-errors";

export type GovernanceActor = {
  userId: string;
  organizationId: number | null;
  role: "OPS" | "REVIEWER" | "VENDOR" | "UNKNOWN";
};

function parseOpsUsers() {
  return new Set(
    (process.env.TRUVERN_OPS_USERS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

async function findDbUserIdFromClerkUserId(clerkUserId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
    select id
    from "User"
    where "clerkUserId" = $1
       or id::text = $1
    limit 1
    `,
    clerkUserId,
  );

  return rows[0]?.id ?? null;
}

export async function getGovernanceActor(): Promise<GovernanceActor> {
  const session = await auth();
  const userId = session.userId;

  if (!userId) {
    throw governanceUnauthorized("Authentication required.");
  }

  const opsUsers = parseOpsUsers();

  if (opsUsers.has(userId)) {
    return {
      userId,
      organizationId: null,
      role: "OPS",
    };
  }

  const dbUserId = await findDbUserIdFromClerkUserId(userId);

  const membership = dbUserId
    ? await prisma.orgMembership.findFirst({
        where: {
          userId: dbUserId,
        },
        select: {
          organizationId: true,
          role: true,
        },
        orderBy: [{ id: "asc" }],
      })
    : null;

  if (!membership) {
    return {
      userId,
      organizationId: null,
      role: "UNKNOWN",
    };
  }

  const normalizedRole = String(membership.role ?? "").toUpperCase();

  return {
    userId,
    organizationId: membership.organizationId,
    role:
      normalizedRole.includes("REVIEW") ||
      normalizedRole.includes("ADMIN") ||
      normalizedRole.includes("OWNER") ||
      normalizedRole.includes("ANALYST")
        ? "REVIEWER"
        : normalizedRole.includes("VENDOR")
          ? "VENDOR"
          : "UNKNOWN",
  };
}

export async function requireOpsAccess() {
  const actor = await getGovernanceActor();

  if (actor.role !== "OPS") {
    throw governanceForbidden("Truvern Ops access required.");
  }

  return actor;
}

export async function requireReviewerAccess() {
  const actor = await getGovernanceActor();

  if (!["OPS", "REVIEWER"].includes(actor.role)) {
    throw governanceForbidden("Reviewer access required.");
  }

  return actor;
}

export async function requireFrameworkAssessmentAccess(assessmentId: number) {
  const actor = await getGovernanceActor();

  const assessment = await prisma.truvernFrameworkAssessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      organizationId: true,
      vendorId: true,
      releasedAt: true,
    },
  });

  if (!assessment) {
    throw governanceForbidden("Framework assessment not found.");
  }

  if (actor.role === "OPS") {
    return { actor, assessment };
  }

  if (
    actor.organizationId &&
    assessment.organizationId &&
    actor.organizationId === assessment.organizationId
  ) {
    return { actor, assessment };
  }

  throw governanceForbidden("You do not have access to this framework assessment.");
}

export async function requireVendorAssessmentAccess(assessmentId: number) {
  const access = await requireFrameworkAssessmentAccess(assessmentId);

  if (!["OPS", "VENDOR", "REVIEWER"].includes(access.actor.role)) {
    throw governanceForbidden("Vendor review access required.");
  }

  return access;
}

export async function requireEvidenceAccess(assessmentId: number) {
  return requireFrameworkAssessmentAccess(assessmentId);
}

export async function requireReleasePacketAccess(assessmentId: number) {
  const access = await requireFrameworkAssessmentAccess(assessmentId);

  if (!access.assessment.releasedAt) {
    throw governanceForbidden("Assessment release packet is not available yet.");
  }

  return access;
}




