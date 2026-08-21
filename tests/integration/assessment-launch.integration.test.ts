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

describe(
  "RS-3B.1 assessment launch service",
  () => {
    let launchAssessment: LaunchAssessment;

    const assessmentIds = new Set<number>();
    const assessmentRunIds = new Set<number>();
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

      /*
       * Import only after integration environment
       * configuration so the production Prisma singleton
       * resolves to TEST_DATABASE_URL.
       */
      const service = await import(
        "@/lib/services/assessment-launch-service"
      );

      launchAssessment =
        service.launchAssessment;
    });

    afterEach(async () => {
      const prisma = getIntegrationPrisma();

      if (assessmentRunIds.size > 0) {
        await prisma.assessmentRun.deleteMany({
          where: {
            id: {
              in: [...assessmentRunIds],
            },
          },
        });
      }

      if (assessmentIds.size > 0) {
        await prisma.assessment.deleteMany({
          where: {
            id: {
              in: [...assessmentIds],
            },
          },
        });
      }

      if (assessmentTemplateIds.size > 0) {
        await prisma.assessmentTemplate.deleteMany({
          where: {
            id: {
              in: [...assessmentTemplateIds],
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
      "creates a launched assessment and reuses it on a repeated launch",
      async () => {
        const prisma = getIntegrationPrisma();

        const suffix = randomUUID()
          .replaceAll("-", "")
          .slice(0, 16)
          .toLowerCase();

        const template =
          await prisma.assessmentTemplate.create({
            data: {
              name:
                `RS-3B Integration Launch Template ${suffix}`,
              code:
                `rs-3b-launch-${suffix}`,
              description:
                "Database-backed assessment launch integration template.",
              standard: "INTEGRATION_TEST",
              category: "INTEGRATION_TEST",
              version: "1.0",
              isActive: true,
              source: "CUSTOM",
              accessTier: "PRO",
              isSystem: false,
              isFeatured: false,
              origin: "CUSTOM",
            },
          });

        assessmentTemplateIds.add(template.id);
        const organization =
          await createOrganizationFixture({
            planTier: "PRO",
          });

        const vendor =
          await createVendorFixture({
            organizationId: organization.id,
            status: "INTAKE",
            contactName:
              "RS-3B Vendor Contact",
            contactEmail:
              "rs-3b-vendor@example.test",
          });

        const dueAt =
          new Date("2030-06-30T12:00:00.000Z");

        const firstLaunch =
          await launchAssessment({
            vendorId: vendor.id,
            templateId: template.id,
            currentPlanTier: "PRO",
            title:
              "RS-3B Assessment Launch",
            dueAt,
          });

        expect(firstLaunch.ok).toBe(true);

        if (!firstLaunch.ok) {
          throw new Error(firstLaunch.error);
        }

        assessmentIds.add(
          firstLaunch.assessmentId,
        );

        if (
          firstLaunch.assessmentRunId !== null
        ) {
          assessmentRunIds.add(
            firstLaunch.assessmentRunId,
          );
        }

        expect(firstLaunch.reused).toBe(false);
        expect(firstLaunch.token).toMatch(
          /^[a-f0-9]{48}$/,
        );

        expect(firstLaunch.vendorUrl).toBe(
          `/vendor-assessment/${firstLaunch.token}`,
        );

        expect(firstLaunch.redirectUrl).toBe(
          `/assessments/${firstLaunch.assessmentId}/launch`,
        );

        const persistedAssessment =
          await prisma.assessment.findUnique({
            where: {
              id: firstLaunch.assessmentId,
            },
          });

        expect(
          persistedAssessment,
        ).not.toBeNull();

        expect(
          persistedAssessment?.organizationId,
        ).toBe(organization.id);

        expect(
          persistedAssessment?.vendorId,
        ).toBe(vendor.id);

        expect(
          persistedAssessment?.templateId,
        ).toBe(template.id);

        expect(
          persistedAssessment?.status,
        ).toBe("LAUNCHED");

        expect(
          persistedAssessment?.title,
        ).toBe("RS-3B Assessment Launch");

        expect(
          persistedAssessment?.token,
        ).toBe(firstLaunch.token);

        expect(
          persistedAssessment?.vendorEmail,
        ).toBe(
          "rs-3b-vendor@example.test",
        );

        expect(
          persistedAssessment?.vendorContactName,
        ).toBe(
          "RS-3B Vendor Contact",
        );

        expect(
          persistedAssessment?.completionPercent,
        ).toBe(0);

        expect(
          persistedAssessment?.isVendorSubmitted,
        ).toBe(false);

        expect(
          persistedAssessment?.launchedAt,
        ).not.toBeNull();

        expect(
          persistedAssessment?.startedAt,
        ).not.toBeNull();

        expect(
          persistedAssessment?.dueAt?.toISOString(),
        ).toBe(dueAt.toISOString());

        expect(
          firstLaunch.assessmentRunId,
        ).not.toBeNull();

        const persistedRun =
          firstLaunch.assessmentRunId === null
            ? null
            : await prisma.assessmentRun.findUnique({
                where: {
                  id:
                    firstLaunch.assessmentRunId,
                },
              });

        expect(persistedRun).not.toBeNull();

        expect(
          persistedRun?.organizationId,
        ).toBe(organization.id);

        expect(
          persistedRun?.vendorId,
        ).toBe(vendor.id);

        expect(
          persistedRun?.assessmentId,
        ).toBe(firstLaunch.assessmentId);

        expect(
          persistedRun?.templateId,
        ).toBe(template.id);

        expect(persistedRun?.status).toBe(
          "LAUNCHED",
        );

        expect(
          persistedRun?.startedAt,
        ).not.toBeNull();

        const secondLaunch =
          await launchAssessment({
            vendorId: vendor.id,
            templateId: template.id,
            currentPlanTier: "PRO",
            title:
              "This title must not create another assessment",
            dueAt:
              new Date(
                "2031-01-01T12:00:00.000Z",
              ),
          });

        expect(secondLaunch.ok).toBe(true);

        if (!secondLaunch.ok) {
          throw new Error(secondLaunch.error);
        }

        expect(secondLaunch.reused).toBe(true);

        expect(
          secondLaunch.assessmentId,
        ).toBe(firstLaunch.assessmentId);

        expect(
          secondLaunch.assessmentRunId,
        ).toBe(firstLaunch.assessmentRunId);

        expect(secondLaunch.token).toBe(
          firstLaunch.token,
        );

        const assessmentCount =
          await prisma.assessment.count({
            where: {
              organizationId: organization.id,
              vendorId: vendor.id,
              templateId: template.id,
            },
          });

        expect(assessmentCount).toBe(1);

        const runCount =
          await prisma.assessmentRun.count({
            where: {
              assessmentId:
                firstLaunch.assessmentId,
            },
          });

        expect(runCount).toBe(1);
      },
      30_000,
    );
  },
);