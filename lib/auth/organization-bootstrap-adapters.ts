import { Prisma } from "@prisma/client";

import type {
  BootstrapOrganizationResolution,
  BootstrapUserResolution,
} from "@/lib/auth/organization-bootstrap-service";
import prisma from "@/lib/prisma";
import {
  claimGovernanceDbUserByEmail,
  readGovernanceDbUserId,
} from "@/lib/repositories/governance-auth-repository";

type BootstrapOrganizationClient = Pick<
  Prisma.TransactionClient,
  "organization"
>;

type BootstrapUserReaders = {
  readUser: typeof readGovernanceDbUserId;
  claimUser: typeof claimGovernanceDbUserByEmail;
};

const defaultUserReaders: BootstrapUserReaders = {
  readUser: readGovernanceDbUserId,
  claimUser: claimGovernanceDbUserByEmail,
};

function normalizeOrganizationSlugPart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildBootstrapOrganizationSlug(input: {
  organizationName: string;
  clerkOrganizationId: string;
}) {
  const namePart =
    normalizeOrganizationSlugPart(
      input.organizationName,
    ) || "organization";

  const identityPart =
    normalizeOrganizationSlugPart(
      input.clerkOrganizationId,
    ) || "clerk";

  /*
   * Organization.slug is UNIQUE.
   *
   * Include the immutable Clerk organization identity so that:
   * - retries derive the same slug;
   * - two Clerk organizations with similar names do not intentionally
   *   target the same slug;
   * - no Date.now()/random suffix is needed.
   *
   * Keep the human-readable portion bounded while retaining the
   * complete normalized Clerk identity suffix.
   */
  const boundedName =
    namePart.slice(
      0,
      Math.max(
        1,
        48 - identityPart.length - 1,
      ),
    );

  return `${boundedName}-${identityPart}`;
}

export async function resolveBootstrapUser(
  input: {
    clerkUserId: string;
    email: string;
  },
  readers: BootstrapUserReaders = defaultUserReaders,
): Promise<BootstrapUserResolution> {
  const clerkUserId = input.clerkUserId.trim();
  const email = input.email.trim().toLowerCase();

  if (!clerkUserId || !email) {
    return {
      ok: false,
      reason: "USER_NOT_PROVISIONED",
    };
  }

  /*
   * Exact Clerk binding wins.
   *
   * Do not rely on the legacy numeric compatibility fallback as an
   * identity claim: an exact result must still be confirmed through
   * the existing repository contract.
   */
  const existing =
    await readers.readUser(clerkUserId);

  if (existing.length === 1) {
    return {
      ok: true,
      userId: existing[0].id,
      claimed: false,
    };
  }

  if (existing.length > 1) {
    return {
      ok: false,
      reason: "USER_IDENTITY_CONFLICT",
    };
  }

  const claimed =
    await readers.claimUser({
      clerkUserId,
      email,
    });

  if (!claimed) {
    return {
      ok: false,
      reason: "USER_NOT_PROVISIONED",
    };
  }

  /*
   * Re-read by Clerk identity after the atomic email claim.
   * This confirms the resulting identity binding rather than trusting
   * the pre-claim email lookup alone.
   */
  const confirmed =
    await readers.readUser(clerkUserId);

  if (
    confirmed.length !== 1 ||
    confirmed[0].id !== claimed.id
  ) {
    return {
      ok: false,
      reason: "USER_IDENTITY_CONFLICT",
    };
  }

  return {
    ok: true,
    userId: claimed.id,
    claimed: true,
  };
}

function sameOrganizationIdentity(
  organization: {
    clerkOrgId: string | null;
  },
  clerkOrganizationId: string,
) {
  return (
    organization.clerkOrgId ===
    clerkOrganizationId
  );
}

export async function resolveBootstrapOrganization(
  input: {
    clerkOrganizationId: string;
    organizationName: string;
  },
  client: BootstrapOrganizationClient = prisma,
): Promise<BootstrapOrganizationResolution> {
  const clerkOrganizationId =
    input.clerkOrganizationId.trim();

  const organizationName =
    input.organizationName.trim();

  if (
    !clerkOrganizationId ||
    !organizationName
  ) {
    return {
      ok: false,
      reason: "ORGANIZATION_BOOTSTRAP_FAILED",
    };
  }

  const existing =
    await client.organization.findUnique({
      where: {
        clerkOrgId: clerkOrganizationId,
      },
      select: {
        id: true,
        clerkOrgId: true,
      },
    });

  if (existing) {
    return sameOrganizationIdentity(
      existing,
      clerkOrganizationId,
    )
      ? {
          ok: true,
          organizationId: existing.id,
          created: false,
        }
      : {
          ok: false,
          reason: "ORGANIZATION_IDENTITY_CONFLICT",
        };
  }

  const slug =
    buildBootstrapOrganizationSlug({
      organizationName,
      clerkOrganizationId,
    });

  try {
    const created =
      await client.organization.create({
        data: {
          clerkOrgId: clerkOrganizationId,
          name: organizationName,
          slug,
        },
        select: {
          id: true,
          clerkOrgId: true,
        },
      });

    if (
      !sameOrganizationIdentity(
        created,
        clerkOrganizationId,
      )
    ) {
      return {
        ok: false,
        reason: "ORGANIZATION_IDENTITY_CONFLICT",
      };
    }

    return {
      ok: true,
      organizationId: created.id,
      created: true,
    };
  } catch (error) {
    /*
     * clerkOrgId, name and slug are UNIQUE.
     *
     * A concurrent request may create the same exact Clerk binding
     * after our initial read. On P2002, re-read by the authoritative
     * Clerk organization identity. Accept only that exact winner.
     *
     * A collision on name/slug belonging to another Clerk
     * organization therefore fails closed.
     */
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced =
        await client.organization.findUnique({
          where: {
            clerkOrgId: clerkOrganizationId,
          },
          select: {
            id: true,
            clerkOrgId: true,
          },
        });

      if (
        raced &&
        sameOrganizationIdentity(
          raced,
          clerkOrganizationId,
        )
      ) {
        return {
          ok: true,
          organizationId: raced.id,
          created: false,
        };
      }

      return {
        ok: false,
        reason: "ORGANIZATION_IDENTITY_CONFLICT",
      };
    }

    throw error;
  }
}