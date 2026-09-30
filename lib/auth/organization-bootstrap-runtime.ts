import {
  auth,
  currentUser,
} from "@clerk/nextjs/server";

import {
  resolveBootstrapOrganization,
  resolveBootstrapUser,
} from "@/lib/auth/organization-bootstrap-adapters";
import {
  bootstrapCurrentOrganization,
  type BootstrapCurrentOrganizationResult,
} from "@/lib/auth/organization-bootstrap-service";
import {
  provisioningReadAdapterDependencies,
} from "@/lib/auth/organization-provisioning-read-adapters";
import {
  verifyCurrentOrganizationProvisioning,
} from "@/lib/auth/organization-provisioning-verifier";

export type RuntimeOrganizationBootstrapResult =
  BootstrapCurrentOrganizationResult;

type RuntimeAuthContext = {
  userId: string | null;
  orgId: string | null;
};

type RuntimeUserIdentity =
  | {
      id: string;
      primaryEmailAddress: {
        emailAddress: string;
      } | null;
    }
  | null;

type RuntimeBootstrapDependencies = {
  getAuthContext: () => Promise<RuntimeAuthContext>;
  getCurrentUserIdentity: () => Promise<RuntimeUserIdentity>;
  runBootstrap: (input: {
    authenticatedUserId: string | null;
    selectedOrganizationId: string | null;
    targetOrganizationId: string;
    authenticatedEmail: string | null;
  }) => Promise<BootstrapCurrentOrganizationResult>;
};

async function runCertifiedBootstrap(input: {
  authenticatedUserId: string | null;
  selectedOrganizationId: string | null;
  targetOrganizationId: string;
  authenticatedEmail: string | null;
}): Promise<BootstrapCurrentOrganizationResult> {
  return bootstrapCurrentOrganization(
    input,
    {
      async verifyIdentity(verificationInput) {
        const decision =
          await verifyCurrentOrganizationProvisioning(
            verificationInput,
          );

        if (!decision.allowed) {
          return decision;
        }

        const organization =
          await provisioningReadAdapterDependencies
            .getClerkOrganization({
              organizationId:
                verificationInput.targetOrganizationId,
            });

        if (
          !organization ||
          organization.id !==
            verificationInput.targetOrganizationId ||
          !organization.name.trim()
        ) {
          return {
            allowed: false,
            reason: "ORGANIZATION_IDENTITY_REQUIRED",
          };
        }

        return {
          allowed: true,
          role: decision.role,
          organizationName: organization.name.trim(),
        };
      },

      resolveUser: resolveBootstrapUser,
      resolveOrganization: resolveBootstrapOrganization,
    },
  );
}

const runtimeBootstrapDependencies: RuntimeBootstrapDependencies = {
  async getAuthContext() {
    const session = await auth();

    return {
      userId: session.userId ?? null,
      orgId: session.orgId ?? null,
    };
  },

  async getCurrentUserIdentity() {
    const user =
      await currentUser().catch(() => null);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      primaryEmailAddress:
        user.primaryEmailAddress
          ? {
              emailAddress:
                user.primaryEmailAddress.emailAddress,
            }
          : null,
    };
  },

  runBootstrap: runCertifiedBootstrap,
};

/*
 * Runtime composition boundary for explicit organization bootstrap.
 *
 * This layer may read authenticated Clerk runtime identity, but it does
 * not create Clerk resources, write Prisma records, map roles, or
 * implement membership policy.
 */
export async function bootstrapCurrentOrganizationFromRuntime(
  dependencies: RuntimeBootstrapDependencies =
    runtimeBootstrapDependencies,
): Promise<RuntimeOrganizationBootstrapResult> {
  const context =
    await dependencies.getAuthContext();

  const authenticatedUserId =
    context.userId?.trim() ?? "";

  const selectedOrganizationId =
    context.orgId?.trim() ?? "";

  if (!authenticatedUserId) {
    return {
      ok: false,
      reason: "UNAUTHENTICATED",
    };
  }

  if (!selectedOrganizationId) {
    return {
      ok: false,
      reason: "NO_SELECTED_ORGANIZATION",
    };
  }

  const user =
    await dependencies.getCurrentUserIdentity();

  if (
    !user ||
    user.id.trim() !== authenticatedUserId
  ) {
    return {
      ok: false,
      reason: "AUTHENTICATED_IDENTITY_MISMATCH",
    };
  }

  const authenticatedEmail =
    user.primaryEmailAddress?.emailAddress
      ?.trim()
      .toLowerCase() ?? "";

  if (!authenticatedEmail) {
    return {
      ok: false,
      reason: "AUTHENTICATED_EMAIL_REQUIRED",
    };
  }

  return dependencies.runBootstrap({
    authenticatedUserId,
    selectedOrganizationId,
    targetOrganizationId:
      selectedOrganizationId,
    authenticatedEmail,
  });
}