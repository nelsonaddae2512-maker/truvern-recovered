import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { governanceForbidden, governanceUnauthorized } from "@/lib/auth/governance-auth-errors";
import { readGovernanceDbUserId } from "@/lib/repositories/governance-auth-repository";
import { getCurrentTruvernAccess } from "@/lib/truvern-ops-access";

export type GovernanceActor = {
  userId: string;
  organizationId: number | null;
  vendorId: number | null;
  role:
    | "OPS"
    | "TRUVERN_REVIEWER"
    | "OWNER"
    | "ADMIN"
    | "ANALYST"
    | "VIEWER"
    | "VENDOR"
    | "UNKNOWN";
};

export type GovernanceCapability =
  | "governance.read"
  | "assessment.manage"
  | "assessment.review"
  | "finding.manage"
  | "governance.approve"
  | "report.release"
  | "member.manage"
  | "billing.manage";

const GOVERNANCE_CAPABILITIES_BY_ROLE = {
  OPS: [
    "governance.read",
    "assessment.manage",
    "assessment.review",
    "finding.manage",
    "governance.approve",
    "report.release",
  ],
  TRUVERN_REVIEWER: [
    "governance.read",
    "assessment.review",
    "finding.manage",
  ],
  OWNER: [
    "governance.read",
    "assessment.manage",
    "assessment.review",
    "finding.manage",
    "governance.approve",
    "report.release",
    "member.manage",
    "billing.manage",
  ],
  ADMIN: [
    "governance.read",
    "assessment.manage",
    "assessment.review",
    "finding.manage",
    "governance.approve",
    "report.release",
    "member.manage",
  ],
  ANALYST: [
    "governance.read",
    "assessment.manage",
    "assessment.review",
    "finding.manage",
  ],
  VIEWER: [
    "governance.read",
  ],
  VENDOR: [],
  UNKNOWN: [],
} satisfies Record<
  GovernanceActor["role"],
  readonly GovernanceCapability[]
>;

export function hasGovernanceCapability(
  actor: GovernanceActor,
  capability: GovernanceCapability,
) {
  const capabilities: readonly GovernanceCapability[] =
    GOVERNANCE_CAPABILITIES_BY_ROLE[actor.role];

  return capabilities.includes(capability);
}

export function requireGovernanceCapability(
  actor: GovernanceActor,
  capability: GovernanceCapability,
) {
  if (!hasGovernanceCapability(actor, capability)) {
    throw governanceForbidden(
      `Governance capability required: ${capability}.`,
    );
  }

  return actor;
}

function parseOpsUsers() {
  return new Set(
    (process.env.TRUVERN_OPS_USERS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

async function findDbUserIdFromClerkUserId(clerkUserId: string) {
  const rows = await readGovernanceDbUserId(clerkUserId);

  return rows[0]?.id ?? null;
}

export async function getGovernanceActor(): Promise<GovernanceActor> {
  const session = await auth();
  const userId = session.userId;

  if (!userId) {
    throw governanceUnauthorized("Authentication required.");
  }

  const opsUsers = parseOpsUsers();
  const truvernAccess = await getCurrentTruvernAccess();

  if (opsUsers.has(userId) || truvernAccess.isTruvernOperator) {
    return {
      userId,
      organizationId: null,
      vendorId: null,
      role: "OPS",
    };
  }

  /*
   * Vendor identity is an explicit Clerk-user -> org -> vendor binding.
   * It must be resolved before generic organization membership so that
   * vendor routes can enforce the actual assessment.vendorId boundary.
   */
  const vendorPortalUser = await prisma.vendorPortalUser.findUnique({
    where: {
      clerkUserId: userId,
    },
    select: {
      organizationId: true,
      vendorId: true,
    },
  });

  if (vendorPortalUser) {
    return {
      userId,
      organizationId: vendorPortalUser.organizationId,
      vendorId: vendorPortalUser.vendorId,
      role: "VENDOR",
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
      vendorId: null,
      role: truvernAccess.isTruvernReviewer
        ? "TRUVERN_REVIEWER"
        : "UNKNOWN",
    };
  }

  const normalizedRole =
    String(membership.role ?? "").toUpperCase();

  return {
    userId,
    organizationId: membership.organizationId,
    vendorId: null,
    role:
      normalizedRole === "OWNER" ||
      normalizedRole === "ADMIN" ||
      normalizedRole === "ANALYST" ||
      normalizedRole === "VIEWER"
        ? normalizedRole
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

  if (
    ![
      "OPS",
      "TRUVERN_REVIEWER",
      "OWNER",
      "ADMIN",
      "ANALYST",
    ].includes(actor.role)
  ) {
    throw governanceForbidden("Reviewer access required.");
  }

  return actor;
}

export async function requireFrameworkAssessmentAccess(assessmentId: number) {
  const actor = await getGovernanceActor();

  const assessment =
    await prisma.truvernFrameworkAssessment.findUnique({
      where: {
        id: assessmentId,
      },
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

  if (actor.role === "VENDOR") {
    if (
      actor.organizationId &&
      actor.vendorId &&
      assessment.organizationId &&
      assessment.vendorId &&
      actor.organizationId === assessment.organizationId &&
      actor.vendorId === assessment.vendorId
    ) {
      return { actor, assessment };
    }

    throw governanceForbidden(
      "You do not have access to this vendor framework assessment.",
    );
  }

  if (
    ["OWNER", "ADMIN", "ANALYST", "VIEWER"].includes(
      actor.role,
    ) &&
    actor.organizationId &&
    assessment.organizationId &&
    actor.organizationId === assessment.organizationId
  ) {
    return { actor, assessment };
  }

  throw governanceForbidden(
    "You do not have access to this framework assessment.",
  );
}
export async function requireVendorAssessmentAccess(assessmentId: number) {
  const access =
    await requireFrameworkAssessmentAccess(assessmentId);

  if (!["OPS", "VENDOR"].includes(access.actor.role)) {
    throw governanceForbidden(
      "Vendor review access required.",
    );
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
