import { auth } from "@clerk/nextjs/server";

import {
  provisionCurrentOrganization,
} from "@/lib/auth/organization-provisioning-service";
import prisma from "@/lib/prisma";

type DbOrg = {
  id: number;
  name: string;
  slug: string;
  clerkOrgId: string | null;
};

type NeedsOrgSelection = {
  _needsOrgSelection: true;
};

const NEEDS_ORG_SELECTION: NeedsOrgSelection = {
  _needsOrgSelection: true,
};

export async function requireDbOrganization(): Promise<
  DbOrg | NeedsOrgSelection
> {
  const { userId, orgId } = await auth();

  /*
   * Ordinary organization resolution must never create or rebind
   * a Truvern organization as a side effect.
   *
   * Verified provisioning requires both an authenticated user and
   * an explicitly selected Clerk organization.
   */
  if (!userId || !orgId) {
    return NEEDS_ORG_SELECTION;
  }

  /*
   * The selected Clerk organization must already have an exact
   * Truvern Organization binding.
   *
   * Initial organization creation belongs to a separate,
   * explicitly authorized onboarding boundary.
   */
  const organization =
    await prisma.organization.findUnique({
      where: {
        clerkOrgId: orgId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        clerkOrgId: true,
      },
    });

  if (!organization) {
    return NEEDS_ORG_SELECTION;
  }

  /*
   * Run the certified verification + persistence boundary.
   *
   * It may create the verified OrgMembership and synchronize the
   * user's primary organization pointer, but it cannot create or
   * rebind the Organization.
   */
  const provisioned =
    await provisionCurrentOrganization({
      authenticatedUserId: userId,
      selectedOrganizationId: orgId,
      targetOrganizationId: orgId,
    });

  if (!provisioned.ok) {
    return NEEDS_ORG_SELECTION;
  }

  /*
   * Defense in depth: the persisted organization must be exactly
   * the organization resolved from the selected Clerk org.
   */
  if (
    provisioned.organizationId !==
    organization.id
  ) {
    return NEEDS_ORG_SELECTION;
  }

  return organization;
}
