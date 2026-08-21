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
  createVendorFixture,
  resetIntegrationFixtureRegistry,
} from "@/tests/support/integration/fixtures";

type MutateReviewAssignment =
  typeof import(
    "@/lib/services/review-assignment-service"
  )["mutateReviewAssignment"];

describe(
  "RS-3C.1 review assignment service",
  () => {
    let mutateReviewAssignment:
      MutateReviewAssignment;

    const ledgerEntryIds =
      new Set<number>();

    beforeAll(async () => {
      const environment =
        configureIntegrationEnvironment();

      await connectIntegrationDatabase(
        environment.identity,
      );

      await verifyIntegrationConnection(
        environment.identity,
      );

      /*
       * Import after integration environment setup
       * so the application Prisma singleton uses the
       * dedicated integration database.
       */
      const service =
        await import(
          "@/lib/services/review-assignment-service"
        );

      mutateReviewAssignment =
        service.mutateReviewAssignment;
    });

    afterEach(async () => {
      const prisma =
        getIntegrationPrisma();

      if (ledgerEntryIds.size > 0) {
        await prisma.$executeRawUnsafe(
          `
          delete from "TruvernCreditLedgerEntry"
          where id = any($1::int[])
          `,
          [...ledgerEntryIds],
        );
      }

      ledgerEntryIds.clear();

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
      "assigns an internal reviewer and records lifecycle timestamps",
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
            status: "SUBMISSION",
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
            status: "PENDING",
          });

        const result =
          await mutateReviewAssignment({
            assignmentId:
              assignment.id,
            action: "assign",
            actorUserId:
              "user_rs3c_actor",
            actorName:
              "RS-3C Actor",
            reviewerUserId:
              "user_rs3c_reviewer",
            reviewerName:
              "RS-3C Reviewer",
          });

        expect(result.ok).toBe(true);

        if (!result.ok) {
          throw new Error(
            result.error,
          );
        }

        expect(result.action).toBe(
          "assign",
        );

        const persisted =
          await prisma.reviewAssignment.findUnique({
            where: {
              id: assignment.id,
            },
          });

        expect(
          persisted?.assignmentType,
        ).toBe("INTERNAL");

        expect(persisted?.status).toBe(
          "IN_PROGRESS",
        );

        expect(
          persisted?.reviewerUserId,
        ).toBe(
          "user_rs3c_reviewer",
        );

        expect(
          persisted
            ?.assignedReviewerName,
        ).toBe("RS-3C Reviewer");

        expect(
          persisted?.reviewerName,
        ).toBe("RS-3C Reviewer");

        expect(
          persisted?.assignedTo,
        ).toBe("RS-3C Reviewer");

        expect(
          persisted?.startedAt,
        ).not.toBeNull();

        expect(
          persisted?.claimedAt,
        ).not.toBeNull();
      },
      30_000,
    );

    test(
      "routes a pending assignment to Truvern, reserves one credit, and reverses it on unassign",
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
            status: "SUBMISSION",
          });

        const request =
          await createReviewRequestFixture({
            organizationId:
              organization.id,
            vendorId: vendor.id,
            kind: "TRUVERN_REVIEW",
            status: "REQUESTED",
            note:
              "RS-3C.1 credit lifecycle.",
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
            status: "PENDING",
          });
        const grant =
          await prisma.truvernCreditLedgerEntry.create({
            data: {
              organizationId:
                organization.id,
              reviewAssignmentId: null,
              reviewRequestId:
                request.id,
              vendorId: vendor.id,
              eventKey:
                `rs-3c1:grant:${assignment.id}`,
              entryType: "GRANT",
              fundingSource:
                "OPERATOR_GRANT",
              status: "POSTED",
              availableDelta: 1,
              reservedDelta: 0,
              consumedDelta: 0,
              quantity: 1,
              note:
                "RS-3C.1 integration credit grant.",
              metadataJson: {
                source:
                  "rs_3c1_integration_test",
                actorUserId:
                  "user_rs3c_operator",
              },
            },
          });

        ledgerEntryIds.add(grant.id);
const routed =
          await mutateReviewAssignment({
            assignmentId:
              assignment.id,
            action: "truvern",
            actorUserId:
              "user_rs3c_customer",
            reviewCreditCost: 1,
          });

        expect(routed.ok).toBe(true);

        if (!routed.ok) {
          throw new Error(
            routed.error,
          );
        }

        expect(routed.action).toBe(
          "truvern",
        );

        expect(
          routed.reservation
            ?.reservedCredits,
        ).toBe(1);

        expect(
          routed.reservation?.reused,
        ).toBe(false);

        const routedAssignment =
          await prisma.reviewAssignment.findUnique({
            where: {
              id: assignment.id,
            },
          });

        // RC40D: Professional Review preserves the existing assignment
        // and review request. Escalation changes responsibility/type
        // without creating a duplicate review assignment.
        expect(routedAssignment?.id).toBe(
          assignment.id,
        );

        expect(
          routedAssignment?.reviewRequestId,
        ).toBe(request.id);

        const assignmentCountAfterRoute =
          await prisma.reviewAssignment.count({
            where: {
              reviewRequestId: request.id,
            },
          });

        expect(
          assignmentCountAfterRoute,
        ).toBe(1);

        expect(
          routedAssignment
            ?.assignmentType,
        ).toBe("TRUVERN");

        expect(
          routedAssignment?.status,
        ).toBe("PENDING");

        expect(
          routedAssignment
            ?.reviewerUserId,
        ).toBeNull();

        expect(
          routedAssignment
            ?.assignedReviewerName,
        ).toBe("Truvern expert");

        expect(
          routedAssignment?.startedAt,
        ).toBeNull();

        expect(
          routedAssignment?.claimedAt,
        ).toBeNull();

        const reservationRows =
          await prisma.$queryRawUnsafe<
            Array<{
              id: number;
              eventKey: string;
              availableDelta: number;
              reservedDelta: number;
              consumedDelta: number;
            }>
          >(
            `
            select
              id,
              "eventKey",
              "availableDelta",
              "reservedDelta",
              "consumedDelta"
            from "TruvernCreditLedgerEntry"
            where "reviewAssignmentId" = $1
              and "entryType"::text = 'RESERVATION'
              and status = 'POSTED'::text
            order by id asc
            `,
            assignment.id,
          );

        expect(
          reservationRows,
        ).toHaveLength(1);

        expect(
          Number(
            reservationRows[0]
              ?.availableDelta,
          ),
        ).toBe(-1);

        expect(
          Number(
            reservationRows[0]
              ?.reservedDelta,
          ),
        ).toBe(1);

        ledgerEntryIds.add(
          Number(
            reservationRows[0]?.id,
          ),
        );

        const unassigned =
          await mutateReviewAssignment({
            assignmentId:
              assignment.id,
            action: "unassign",
            actorUserId:
              "user_rs3c_customer",
          });

        expect(unassigned.ok).toBe(
          true,
        );

        if (!unassigned.ok) {
          throw new Error(
            unassigned.error,
          );
        }

        expect(
          unassigned.creditReversal
            ?.reversedCredits,
        ).toBe(1);

        expect(
          unassigned.creditReversal
            ?.reused,
        ).toBe(false);

        const finalAssignment =
          await prisma.reviewAssignment.findUnique({
            where: {
              id: assignment.id,
            },
          });

        expect(
          finalAssignment
            ?.assignmentType,
        ).toBe("INTERNAL");

        expect(
          finalAssignment?.status,
        ).toBe("PENDING");

        expect(
          finalAssignment
            ?.reviewerUserId,
        ).toBeNull();

        expect(
          finalAssignment
            ?.assignedReviewerName,
        ).toBeNull();

        const reversalRows =
          await prisma.$queryRawUnsafe<
            Array<{
              id: number;
              availableDelta: number;
              reservedDelta: number;
              consumedDelta: number;
            }>
          >(
            `
            select
              id,
              "availableDelta",
              "reservedDelta",
              "consumedDelta"
            from "TruvernCreditLedgerEntry"
            where "reviewAssignmentId" = $1
              and "entryType"::text = 'REVERSAL'
              and status = 'POSTED'::text
            order by id asc
            `,
            assignment.id,
          );

        expect(
          reversalRows,
        ).toHaveLength(1);

        expect(
          Number(
            reversalRows[0]
              ?.availableDelta,
          ),
        ).toBe(1);

        expect(
          Number(
            reversalRows[0]
              ?.reservedDelta,
          ),
        ).toBe(-1);

        ledgerEntryIds.add(
          Number(
            reversalRows[0]?.id,
          ),
        );

        /*
         * A repeated unassign is safe. The assignment
         * is already internal, so no second reversal
         * ledger entry can be created.
         */
        const repeated =
          await mutateReviewAssignment({
            assignmentId:
              assignment.id,
            action: "unassign",
            actorUserId:
              "user_rs3c_customer",
          });

        expect(repeated.ok).toBe(true);

        const finalReversalCount =
          await prisma.$queryRawUnsafe<
            Array<{ count: number }>
          >(
            `
            select count(*)::int as count
            from "TruvernCreditLedgerEntry"
            where "reviewAssignmentId" = $1
              and "entryType"::text = 'REVERSAL'
              and status = 'POSTED'::text
            `,
            assignment.id,
          );

        expect(
          Number(
            finalReversalCount[0]
              ?.count ?? 0,
          ),
        ).toBe(1);
      },
      30_000,
    );

    test(
      "blocks unassign after a Truvern review has started",
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
            kind: "TRUVERN_REVIEW",
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
              "TRUVERN",
            status: "IN_PROGRESS",
            reviewerUserId:
              "user_rs3c_ops",
            assignedReviewerName:
              "Truvern Reviewer",
            reviewerName:
              "Truvern Reviewer",
            assignedTo:
              "Truvern Reviewer",
            startedAt: new Date(),
          });

        const result =
          await mutateReviewAssignment({
            assignmentId:
              assignment.id,
            action: "unassign",
            actorUserId:
              "user_rs3c_customer",
          });

        expect(result.ok).toBe(false);

        if (result.ok) {
          throw new Error(
            "Expected unassign to be blocked.",
          );
        }

        expect(result.status).toBe(409);

        expect(result.code).toBe(
          "TRUVERN_REVIEW_ALREADY_STARTED",
        );
      },
      30_000,
    );
  },
);
