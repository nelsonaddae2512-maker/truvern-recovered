import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "vitest";
import {
  cleanupIntegrationFixtures,
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
} from "@/tests/support/integration/fixtures";

type ConfirmReviewRelease =
  typeof import(
    "@/lib/services/review-release-service"
  )["confirmReviewRelease"];

describe(
  "RS-3C.2 review release service",
  () => {
    let confirmReviewRelease:
      ConfirmReviewRelease;

    beforeAll(async () => {
      const environment =
        configureIntegrationEnvironment();

      await connectIntegrationDatabase(
        environment.identity,
      );

      await verifyIntegrationConnection(
        environment.identity,
      );

      const service =
        await import(
          "@/lib/services/review-release-service"
        );

      confirmReviewRelease =
        service.confirmReviewRelease;
    });

    afterEach(async () => {
      await cleanupIntegrationFixtures({
        disconnect: false,
        verify: true,
      });

      resetIntegrationFixtureRegistry();
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
      "requires release acknowledgement before database mutation",
      async () => {
        const result =
          await confirmReviewRelease({
            assignmentId: 999999999,
            actorUserId:
              "user_rs3c2_actor",
            acceptedAcknowledgement:
              false,
          });

        expect(result.status).toBe(400);

        expect(result.body).toMatchObject({
          ok: false,
        });

        expect(
          String(result.body.error),
        ).toContain(
          "acknowledgement",
        );
      },
      30_000,
    );

    test(
      "rejects an outcome that has not reached RELEASED state",
      async () => {
        const organization =
          await createOrganizationFixture({
            planTier: "PRO",
          });

        const vendor =
          await createVendorFixture({
            organizationId:
              organization.id,
          });

        const request =
          await createReviewRequestFixture({
            organizationId:
              organization.id,
            vendorId: vendor.id,
            kind: "INTERNAL_REVIEW",
            status: "REQUESTED",
          });

        const assignment =
          await createReviewAssignmentFixture({
            organizationId:
              organization.id,
            vendorId: vendor.id,
            reviewRequestId:
              request.id,
            assignmentType:
              "INTERNAL",
            status: "IN_PROGRESS",
          });

        await createReviewResponseFixture({
          organizationId:
            organization.id,
          reviewRequestId:
            request.id,
          reviewAssignmentId:
            assignment.id,
          responses: {
            releaseState: "DRAFT",
            assignmentType:
              "INTERNAL",
          },
        });

        const result =
          await confirmReviewRelease({
            assignmentId:
              assignment.id,
            actorUserId:
              "user_rs3c2_actor",
            acceptedAcknowledgement:
              true,
          });

        expect(result.status).toBe(409);

        expect(result.body).toMatchObject({
          ok: false,
        });

        expect(
          String(result.body.error),
        ).toContain(
          "released",
        );
      },
      30_000,
    );

    test(
      "returns an already-confirmed outcome idempotently",
      async () => {
        const prisma =
          getIntegrationPrisma();

        const organization =
          await createOrganizationFixture({
            planTier: "PRO",
          });

        const vendor =
          await createVendorFixture({
            organizationId:
              organization.id,
          });

        const request =
          await createReviewRequestFixture({
            organizationId:
              organization.id,
            vendorId: vendor.id,
            kind: "INTERNAL_REVIEW",
            status: "REQUESTED",
          });

        const assignment =
          await createReviewAssignmentFixture({
            organizationId:
              organization.id,
            vendorId: vendor.id,
            reviewRequestId:
              request.id,
            assignmentType:
              "INTERNAL",
            status: "IN_PROGRESS",
          });

        const response =
          await createReviewResponseFixture({
            organizationId:
              organization.id,
            reviewRequestId:
              request.id,
            reviewAssignmentId:
              assignment.id,
            responses: {
              releaseState:
                "CONFIRMED",
              assignmentType:
                "INTERNAL",
              confirmedAt:
                "2026-07-25T12:00:00.000Z",
              governanceReleaseSnapshot: {
                governanceSeal: {
                  checksum:
                    "RS3C2IDEMPOTENTCHECKSUM",
                  sealedAt:
                    "2026-07-25T12:00:00.000Z",
                  notarizationReceipt: {
                    receiptId:
                      "receipt-rs3c2",
                    ledgerHash:
                      "ledger-rs3c2",
                  },
                  transparencyLedgerEntry: {
                    entryId:
                      "entry-rs3c2",
                    entryHash:
                      "hash-rs3c2",
                  },
                },
              },
            },
          });

        const before =
          await prisma.reviewResponse.findUnique({
            where: {
              id: response.id,
            },
          });

        const result =
          await confirmReviewRelease({
            assignmentId:
              assignment.id,
            actorUserId:
              "user_rs3c2_actor",
            acceptedAcknowledgement:
              true,
          });

        expect(result.status).toBe(200);

        expect(result.body).toMatchObject({
          ok: true,
          responseId: response.id,
          releaseState: "CONFIRMED",
          alreadyConfirmed: true,
          checksum:
            "RS3C2IDEMPOTENTCHECKSUM",
        });

        const after =
          await prisma.reviewResponse.findUnique({
            where: {
              id: response.id,
            },
          });

        expect(
          after?.updatedAt.getTime(),
        ).toBe(
          before?.updatedAt.getTime(),
        );
      },
      30_000,
    );
  },
);