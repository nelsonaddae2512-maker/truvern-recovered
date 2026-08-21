import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from "vitest";
import {
  cleanupIntegrationFixtures,
  readIntegrationFixtureLeakCounts,
} from "@/tests/support/integration/cleanup";
import {
  connectIntegrationDatabase,
  disconnectIntegrationDatabase,
  getIntegrationPrisma,
  verifyIntegrationConnection,
} from "@/tests/support/integration/database";
import {
  configureIntegrationEnvironment,
} from "@/tests/support/integration/environment";
import {
  createOrganizationFixture,
  createReviewAssignmentFixture,
  createReviewRequestFixture,
  createReviewResponseFixture,
  createVendorFixture,
  resetIntegrationFixtureRegistry,
  snapshotIntegrationFixtureRegistry,
} from "@/tests/support/integration/fixtures";

describe("RS-3A integration fixture lifecycle", () => {
  beforeAll(async () => {
    const environment =
      configureIntegrationEnvironment();

    await connectIntegrationDatabase(
      environment.identity,
    );

    await verifyIntegrationConnection(
      environment.identity,
    );
  });

  afterAll(async () => {
    try {
      await cleanupIntegrationFixtures({
        disconnect: false,
        verify: true,
      });
    } finally {
      resetIntegrationFixtureRegistry();
      await disconnectIntegrationDatabase();
    }
  });

  test(
    "creates, persists, registers, cleans, and verifies the core review graph",
    async () => {
      const prisma = getIntegrationPrisma();

      const organization =
        await createOrganizationFixture({
          planTier: "PRO",
        });

      const vendor =
        await createVendorFixture({
          organizationId: organization.id,
          tier: "CRITICAL",
          criticality: "HIGH",
          riskScore: 72,
          status: "SUBMISSION",
          contactName:
            "Integration Vendor Contact",
          contactEmail:
            "integration-vendor@example.test",
        });

      const reviewRequest =
        await createReviewRequestFixture({
          organizationId: organization.id,
          vendorId: vendor.id,
          kind: "TRUVERN_REVIEW",
          status: "REQUESTED",
          note:
            "RS-3A.5 database-backed fixture lifecycle.",
        });

      const reviewAssignment =
        await createReviewAssignmentFixture({
          organizationId: organization.id,
          vendorId: vendor.id,
          reviewRequestId: reviewRequest.id,
          assignmentType: "TRUVERN_REVIEW",
          status: "IN_PROGRESS",
          assignedReviewerName:
            "Truvern Integration Reviewer",
          reviewerName:
            "Truvern Integration Reviewer",
          assignedTo: "TRUVERN_OPS",
          startedAt: new Date(),
        });

      const reviewResponse =
        await createReviewResponseFixture({
          organizationId: organization.id,
          reviewRequestId: reviewRequest.id,
          reviewAssignmentId:
            reviewAssignment.id,
          responses: {
            answers: [
              {
                controlId: "AC-2",
                answer: "PARTIAL",
                evidenceProvided: false,
              },
              {
                controlId: "IA-2",
                answer: "YES",
                evidenceProvided: true,
              },
            ],
            source: "RS-3A.5",
          },
          draftSavedAt: new Date(),
        });

      const registry =
        snapshotIntegrationFixtureRegistry();

      expect(registry.organizationIds).toEqual([
        organization.id,
      ]);

      expect(registry.vendorIds).toEqual([
        vendor.id,
      ]);

      expect(registry.reviewRequestIds).toEqual([
        reviewRequest.id,
      ]);

      expect(
        registry.reviewAssignmentIds,
      ).toEqual([
        reviewAssignment.id,
      ]);

      expect(registry.reviewResponseIds).toEqual([
        reviewResponse.id,
      ]);

      const [
        persistedOrganization,
        persistedVendor,
        persistedRequest,
        persistedAssignment,
        persistedResponse,
      ] = await Promise.all([
        prisma.organization.findUnique({
          where: {
            id: organization.id,
          },
        }),
        prisma.vendor.findUnique({
          where: {
            id: vendor.id,
          },
        }),
        prisma.reviewRequest.findUnique({
          where: {
            id: reviewRequest.id,
          },
        }),
        prisma.reviewAssignment.findUnique({
          where: {
            id: reviewAssignment.id,
          },
        }),
        prisma.reviewResponse.findUnique({
          where: {
            id: reviewResponse.id,
          },
        }),
      ]);

      expect(persistedOrganization).not.toBeNull();
      expect(
        persistedOrganization?.planTier,
      ).toBe("PRO");

      expect(persistedVendor).not.toBeNull();
      expect(
        persistedVendor?.organizationId,
      ).toBe(organization.id);
      expect(persistedVendor?.riskScore).toBe(72);

      expect(persistedRequest).not.toBeNull();
      expect(
        persistedRequest?.organizationId,
      ).toBe(organization.id);
      expect(persistedRequest?.vendorId).toBe(
        vendor.id,
      );

      expect(persistedAssignment).not.toBeNull();
      expect(
        persistedAssignment?.reviewRequestId,
      ).toBe(reviewRequest.id);
      expect(
        persistedAssignment?.status,
      ).toBe("IN_PROGRESS");

      expect(persistedResponse).not.toBeNull();
      expect(
        persistedResponse?.reviewAssignmentId,
      ).toBe(reviewAssignment.id);

      const beforeCleanup =
        await readIntegrationFixtureLeakCounts(
          registry,
        );

      expect(beforeCleanup).toEqual({
        organizations: 1,
        vendors: 1,
        reviewRequests: 1,
        reviewAssignments: 1,
        reviewResponses: 1,
      });

      const cleanupResult =
        await cleanupIntegrationFixtures({
          disconnect: false,
          verify: true,
        });

      expect(cleanupResult.deleted).toEqual({
        organizations: 1,
        vendors: 1,
        reviewRequests: 1,
        reviewAssignments: 1,
        reviewResponses: 1,
      });

      expect(cleanupResult.remaining).toEqual({
        organizations: 0,
        vendors: 0,
        reviewRequests: 0,
        reviewAssignments: 0,
        reviewResponses: 0,
      });

      const afterCleanup =
        await readIntegrationFixtureLeakCounts(
          registry,
        );

      expect(afterCleanup).toEqual({
        organizations: 0,
        vendors: 0,
        reviewRequests: 0,
        reviewAssignments: 0,
        reviewResponses: 0,
      });

      expect(
        snapshotIntegrationFixtureRegistry(),
      ).toEqual({
        organizationIds: [],
        vendorIds: [],
        reviewRequestIds: [],
        reviewAssignmentIds: [],
        reviewResponseIds: [],
      });
    },
    30_000,
  );
});

