import { afterEach } from "vitest";
import {
  disconnectIntegrationDatabase,
  getIntegrationPrisma,
} from "./database";
import {
  resetIntegrationFixtureRegistry,
  snapshotIntegrationFixtureRegistry,
  type IntegrationFixtureRegistry,
} from "./fixtures";

export type IntegrationFixtureLeakCounts = {
  organizations: number;
  vendors: number;
  reviewRequests: number;
  reviewAssignments: number;
  reviewResponses: number;
};

export type IntegrationFixtureCleanupResult = {
  deleted: IntegrationFixtureLeakCounts;
  remaining: IntegrationFixtureLeakCounts;
  registry: IntegrationFixtureRegistry;
};

export type CleanupIntegrationFixturesOptions = {
  disconnect?: boolean;
  verify?: boolean;
};

function emptyCounts(): IntegrationFixtureLeakCounts {
  return {
    organizations: 0,
    vendors: 0,
    reviewRequests: 0,
    reviewAssignments: 0,
    reviewResponses: 0,
  };
}

function hasRegisteredFixtures(
  registry: IntegrationFixtureRegistry,
): boolean {
  return (
    registry.organizationIds.length > 0 ||
    registry.vendorIds.length > 0 ||
    registry.reviewRequestIds.length > 0 ||
    registry.reviewAssignmentIds.length > 0 ||
    registry.reviewResponseIds.length > 0
  );
}

function hasLeaks(
  counts: IntegrationFixtureLeakCounts,
): boolean {
  return Object.values(counts).some(
    (count) => count > 0,
  );
}

function formatLeakCounts(
  counts: IntegrationFixtureLeakCounts,
): string {
  return [
    `organizations=${counts.organizations}`,
    `vendors=${counts.vendors}`,
    `reviewRequests=${counts.reviewRequests}`,
    `reviewAssignments=${counts.reviewAssignments}`,
    `reviewResponses=${counts.reviewResponses}`,
  ].join(", ");
}

export async function readIntegrationFixtureLeakCounts(
  registry: IntegrationFixtureRegistry =
    snapshotIntegrationFixtureRegistry(),
): Promise<IntegrationFixtureLeakCounts> {
  if (!hasRegisteredFixtures(registry)) {
    return emptyCounts();
  }

  const prisma = getIntegrationPrisma();

  const [
    organizations,
    vendors,
    reviewRequests,
    reviewAssignments,
    reviewResponses,
  ] = await Promise.all([
    registry.organizationIds.length > 0
      ? prisma.organization.count({
          where: {
            id: {
              in: registry.organizationIds,
            },
          },
        })
      : Promise.resolve(0),

    registry.vendorIds.length > 0
      ? prisma.vendor.count({
          where: {
            id: {
              in: registry.vendorIds,
            },
          },
        })
      : Promise.resolve(0),

    registry.reviewRequestIds.length > 0
      ? prisma.reviewRequest.count({
          where: {
            id: {
              in: registry.reviewRequestIds,
            },
          },
        })
      : Promise.resolve(0),

    registry.reviewAssignmentIds.length > 0
      ? prisma.reviewAssignment.count({
          where: {
            id: {
              in: registry.reviewAssignmentIds,
            },
          },
        })
      : Promise.resolve(0),

    registry.reviewResponseIds.length > 0
      ? prisma.reviewResponse.count({
          where: {
            id: {
              in: registry.reviewResponseIds,
            },
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    organizations,
    vendors,
    reviewRequests,
    reviewAssignments,
    reviewResponses,
  };
}

export async function assertNoIntegrationFixtureLeaks(
  registry: IntegrationFixtureRegistry =
    snapshotIntegrationFixtureRegistry(),
): Promise<void> {
  const remaining =
    await readIntegrationFixtureLeakCounts(registry);

  if (hasLeaks(remaining)) {
    throw new Error(
      [
        "Integration fixture leak detected.",
        formatLeakCounts(remaining),
      ].join(" "),
    );
  }
}

export async function cleanupIntegrationFixtures(
  options: CleanupIntegrationFixturesOptions = {},
): Promise<IntegrationFixtureCleanupResult> {
  const {
    disconnect = false,
    verify = true,
  } = options;

  const registry =
    snapshotIntegrationFixtureRegistry();

  const deleted = emptyCounts();
  let remaining = emptyCounts();

  try {
    if (!hasRegisteredFixtures(registry)) {
      resetIntegrationFixtureRegistry();

      return {
        deleted,
        remaining,
        registry,
      };
    }

    const prisma = getIntegrationPrisma();

    /*
     * Cleanup order:
     *
     * 1. ReviewResponse
     * 2. ReviewAssignment
     * 3. ReviewRequest
     * 4. Vendor
     * 5. Organization
     *
     * Child and ID-referencing workflow records are removed
     * before their owning vendor and organization fixtures.
     */

    if (registry.reviewResponseIds.length > 0) {
      const result =
        await prisma.reviewResponse.deleteMany({
          where: {
            id: {
              in: registry.reviewResponseIds,
            },
          },
        });

      deleted.reviewResponses = result.count;
    }

    if (registry.reviewAssignmentIds.length > 0) {
      const result =
        await prisma.reviewAssignment.deleteMany({
          where: {
            id: {
              in: registry.reviewAssignmentIds,
            },
          },
        });

      deleted.reviewAssignments = result.count;
    }

    if (registry.reviewRequestIds.length > 0) {
      const result =
        await prisma.reviewRequest.deleteMany({
          where: {
            id: {
              in: registry.reviewRequestIds,
            },
          },
        });

      deleted.reviewRequests = result.count;
    }

    if (registry.vendorIds.length > 0) {
      const result = await prisma.vendor.deleteMany({
        where: {
          id: {
            in: registry.vendorIds,
          },
        },
      });

      deleted.vendors = result.count;
    }

    if (registry.organizationIds.length > 0) {
      const result =
        await prisma.organization.deleteMany({
          where: {
            id: {
              in: registry.organizationIds,
            },
          },
        });

      deleted.organizations = result.count;
    }

    remaining =
      await readIntegrationFixtureLeakCounts(
        registry,
      );

    if (verify && hasLeaks(remaining)) {
      throw new Error(
        [
          "Integration fixture cleanup was incomplete.",
          formatLeakCounts(remaining),
        ].join(" "),
      );
    }

    resetIntegrationFixtureRegistry();

    return {
      deleted,
      remaining,
      registry,
    };
  }
  finally {
    if (disconnect) {
      await disconnectIntegrationDatabase();
    }
  }
}

export async function cleanupAndDisconnectIntegrationFixtures():
  Promise<IntegrationFixtureCleanupResult> {
  return cleanupIntegrationFixtures({
    disconnect: true,
    verify: true,
  });
}

export function installIntegrationFixtureCleanup():
  void {
  afterEach(async () => {
    await cleanupIntegrationFixtures({
      disconnect: false,
      verify: true,
    });
  });
}