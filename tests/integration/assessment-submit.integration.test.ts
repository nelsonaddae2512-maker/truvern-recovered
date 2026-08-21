import { randomUUID } from "node:crypto";
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
  createVendorFixture,
  resetIntegrationFixtureRegistry,
} from "@/tests/support/integration/fixtures";

type LaunchAssessment =
  typeof import(
    "@/lib/services/assessment-launch-service"
  )["launchAssessment"];

type SubmitAssessment =
  typeof import(
    "@/lib/services/assessment-submit-service"
  )["submitAssessment"];

describe(
  "RS-3B.2 assessment submission service",
  () => {
    let launchAssessment: LaunchAssessment;
    let submitAssessment: SubmitAssessment;

    const assessmentIds =
      new Set<number>();

    const assessmentRunIds =
      new Set<number>();

    const assessmentTemplateIds =
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

      const launchModule =
        await import(
          "@/lib/services/assessment-launch-service"
        );

      const submitModule =
        await import(
          "@/lib/services/assessment-submit-service"
        );

      launchAssessment =
        launchModule.launchAssessment;

      submitAssessment =
        submitModule.submitAssessment;
    });

    afterEach(async () => {
      const prisma =
        getIntegrationPrisma();

      if (assessmentRunIds.size > 0) {
        await prisma.assessmentRun.deleteMany({
          where: {
            id: {
              in: [
                ...assessmentRunIds,
              ],
            },
          },
        });
      }

      if (assessmentIds.size > 0) {
        await prisma.assessmentAnswer.deleteMany({
          where: {
            assessmentId: {
              in: [
                ...assessmentIds,
              ],
            },
          },
        });

        await prisma.assessment.deleteMany({
          where: {
            id: {
              in: [
                ...assessmentIds,
              ],
            },
          },
        });
      }

      if (
        assessmentTemplateIds.size > 0
      ) {
        await prisma.assessmentTemplate.deleteMany({
          where: {
            id: {
              in: [
                ...assessmentTemplateIds,
              ],
            },
          },
        });
      }

      assessmentRunIds.clear();
      assessmentIds.clear();
      assessmentTemplateIds.clear();

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
      "submits a launched assessment, synchronizes its run, and safely reuses the submitted state",
      async () => {
        const prisma =
          getIntegrationPrisma();

        const suffix =
          randomUUID()
            .replaceAll("-", "")
            .slice(0, 16)
            .toLowerCase();

        /*
         * A zero-question template is intentional:
         * it isolates lifecycle behavior and produces
         * a deterministic completion value of 100%.
         */
        const template =
          await prisma.assessmentTemplate.create({
            data: {
              name:
                `RS-3B.2 Submission Template ${suffix}`,
              code:
                `rs-3b2-submit-${suffix}`,
              description:
                "Database-backed assessment submission integration template.",
              standard:
                "INTEGRATION_TEST",
              category:
                "INTEGRATION_TEST",
              version: "1.0",
              isActive: true,
              source: "CUSTOM",
              accessTier: "PRO",
              isSystem: false,
              isFeatured: false,
              origin: "CUSTOM",
            },
          });

        assessmentTemplateIds.add(
          template.id,
        );

        const organization =
          await createOrganizationFixture({
            planTier: "PRO",
          });

        const vendor =
          await createVendorFixture({
            organizationId:
              organization.id,
            tier: "CRITICAL",
            criticality: "HIGH",
            riskScore: 72,
            status: "SUBMISSION",
            contactName:
              "RS-3B.2 Vendor Contact",
            contactEmail:
              `rs-3b2-${suffix}@example.test`,
          });

        const launchResult =
          await launchAssessment({
            vendorId: vendor.id,
            templateId: template.id,
            currentPlanTier: "PRO",
            title:
              "RS-3B.2 Submission Assessment",
            dueAt: new Date(
              Date.now() +
                7 * 86_400_000,
            ),
          });

        expect(launchResult.ok).toBe(true);

        if (!launchResult.ok) {
          throw new Error(
            launchResult.error,
          );
        }

        assessmentIds.add(
          launchResult.assessmentId,
        );

        if (
          launchResult.assessmentRunId
        ) {
          assessmentRunIds.add(
            launchResult.assessmentRunId,
          );
        }

        const firstSubmission =
          await submitAssessment({
            assessmentId:
              launchResult.assessmentId,
            vendorId: vendor.id,
            token: launchResult.token,
          });

        expect(firstSubmission.ok).toBe(
          true,
        );

        if (!firstSubmission.ok) {
          throw new Error(
            firstSubmission.error,
          );
        }

        expect(
          firstSubmission.alreadySubmitted,
        ).toBe(false);

        expect(
          firstSubmission.assessment.status,
        ).toBe("SUBMITTED");

        expect(
          firstSubmission.assessment
            .isVendorSubmitted,
        ).toBe(true);

        expect(
          firstSubmission.assessment
            .completionPercent,
        ).toBe(100);

        expect(
          firstSubmission.assessment
            .submittedAt,
        ).not.toBeNull();

        expect(
          firstSubmission.assessment
            .reviewReadyAt,
        ).not.toBeNull();

        expect(
          firstSubmission
            .synchronizedRunCount,
        ).toBeGreaterThanOrEqual(1);

        const persistedAssessment =
          await prisma.assessment.findUnique({
            where: {
              id:
                launchResult.assessmentId,
            },
            select: {
              status: true,
              isVendorSubmitted: true,
              completionPercent: true,
              submittedAt: true,
              reviewReadyAt: true,
            },
          });

        expect(
          persistedAssessment?.status,
        ).toBe("SUBMITTED");

        expect(
          persistedAssessment
            ?.isVendorSubmitted,
        ).toBe(true);

        expect(
          persistedAssessment
            ?.completionPercent,
        ).toBe(100);

        expect(
          persistedAssessment
            ?.submittedAt,
        ).not.toBeNull();

        expect(
          persistedAssessment
            ?.reviewReadyAt,
        ).not.toBeNull();

        const persistedRuns =
          await prisma.assessmentRun.findMany({
            where: {
              assessmentId:
                launchResult.assessmentId,
            },
            orderBy: {
              id: "asc",
            },
          });

        expect(
          persistedRuns.length,
        ).toBe(1);

        expect(
          persistedRuns[0]?.status,
        ).toBe("SUBMITTED");

        expect(
          persistedRuns[0]?.completedAt,
        ).not.toBeNull();

        const originalSubmittedAt =
          persistedAssessment?.submittedAt
            ?.getTime();

        const originalRunCompletedAt =
          persistedRuns[0]?.completedAt
            ?.getTime();

        const secondSubmission =
          await submitAssessment({
            assessmentId:
              launchResult.assessmentId,
            vendorId: vendor.id,
            token: launchResult.token,
          });

        expect(secondSubmission.ok).toBe(
          true,
        );

        if (!secondSubmission.ok) {
          throw new Error(
            secondSubmission.error,
          );
        }

        expect(
          secondSubmission.alreadySubmitted,
        ).toBe(true);

        const assessmentCount =
          await prisma.assessment.count({
            where: {
              id:
                launchResult.assessmentId,
            },
          });

        const runCount =
          await prisma.assessmentRun.count({
            where: {
              assessmentId:
                launchResult.assessmentId,
            },
          });

        expect(assessmentCount).toBe(1);
        expect(runCount).toBe(1);

        const finalAssessment =
          await prisma.assessment.findUnique({
            where: {
              id:
                launchResult.assessmentId,
            },
            select: {
              submittedAt: true,
              status: true,
            },
          });

        const finalRun =
          await prisma.assessmentRun.findFirst({
            where: {
              assessmentId:
                launchResult.assessmentId,
            },
            select: {
              completedAt: true,
              status: true,
            },
          });

        expect(
          finalAssessment?.status,
        ).toBe("SUBMITTED");

        expect(
          finalAssessment?.submittedAt
            ?.getTime(),
        ).toBe(originalSubmittedAt);

        expect(finalRun?.status).toBe(
          "SUBMITTED",
        );

        expect(
          finalRun?.completedAt?.getTime(),
        ).toBe(originalRunCompletedAt);
      },
      30_000,
    );
  },
);