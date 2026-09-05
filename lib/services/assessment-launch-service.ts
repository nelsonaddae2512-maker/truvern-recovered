import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import {
  insertAssessmentLaunchRun,
  readAssessmentLaunchTemplate,
} from "@/lib/repositories/assessment-launch-repository";

export type AssessmentLaunchPlanTier =
  | "FREE"
  | "PRO"
  | "ENTERPRISE"
  | string;

export type LaunchAssessmentInput = {
  vendorId: number;
  templateId: number;
  currentPlanTier: AssessmentLaunchPlanTier;
  title?: string | null;
  dueAt?: Date | null;
  vendorEmailOverride?: string | null;
  vendorContactNameOverride?: string | null;
  allowFreeTruvernReviewForControlledOpsCanary?: boolean;
};

export type LaunchAssessmentSuccess = {
  ok: true;
  reused: boolean;
  id: number;
  assessmentId: number;
  assessmentRunId: number | null;
  token: string;
  vendorUrl: string;
  redirectUrl: string;
};

export type LaunchAssessmentFailure = {
  ok: false;
  status: 400 | 403 | 404;
  error: string;
};

export type LaunchAssessmentResult =
  | LaunchAssessmentSuccess
  | LaunchAssessmentFailure;

type AssessmentTemplateRow = {
  id: number;
  name: string;
  accessTier: string | null;
  source: string | null;
  origin: string | null;
  isSystem: boolean;
  isActive: boolean;
};

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function createSuccessResult(input: {
  assessmentId: number;
  assessmentRunId: number | null;
  token: string;
  reused: boolean;
}): LaunchAssessmentSuccess {
  return {
    ok: true,
    reused: input.reused,
    id: input.assessmentId,
    assessmentId: input.assessmentId,
    assessmentRunId: input.assessmentRunId,
    token: input.token,
    vendorUrl:
      `/vendor-assessment/${input.token}`,
    redirectUrl:
      `/assessments/${input.assessmentId}/launch`,
  };
}

export async function launchAssessment(
  input: LaunchAssessmentInput,
): Promise<LaunchAssessmentResult> {
  if (
    !Number.isInteger(input.vendorId) ||
    input.vendorId <= 0
  ) {
    return {
      ok: false,
      status: 400,
      error: "Invalid vendor id.",
    };
  }

  if (
    !Number.isInteger(input.templateId) ||
    input.templateId <= 0
  ) {
    return {
      ok: false,
      status: 400,
      error: "Template is required.",
    };
  }

  const vendor = await prisma.vendor.findUnique({
    where: {
      id: input.vendorId,
    },
    select: {
      id: true,
      name: true,
      organizationId: true,
      contactName: true,
      contactEmail: true,
    },
  });

  if (!vendor) {
    return {
      ok: false,
      status: 404,
      error: "Vendor not found.",
    };
  }

  const templateRows =
    await readAssessmentLaunchTemplate(input.templateId);

  const template = templateRows[0] ?? null;

  if (
    String(input.currentPlanTier).toUpperCase() ===
      "FREE" &&
    template?.name ===
      "Truvern NIST 800-53 Governance Review" &&
    input.allowFreeTruvernReviewForControlledOpsCanary !==
      true
  ) {
    return {
      ok: false,
      status: 403,
      error:
        "This assessment requires a Pro or Enterprise membership. Free users may preview it but cannot launch it.",
    };
  }

  if (!template || !template.isActive) {
    return {
      ok: false,
      status: 404,
      error: "Template not found or inactive.",
    };
  }

  const now = new Date();

  const existingAssessment =
    await prisma.assessment.findFirst({
      where: {
        organizationId: vendor.organizationId,
        vendorId: vendor.id,
        templateId: template.id,
        isVendorSubmitted: false,
        status: {
          in: [
            "LAUNCHED",
            "IN_PROGRESS",
            "DRAFT",
          ] as any,
        },
      } as any,
      orderBy: {
        id: "desc",
      },
      select: {
        id: true,
        token: true,
      },
    });

  const hasVendorSnapshotOverride =
    input.vendorEmailOverride !== undefined ||
    input.vendorContactNameOverride !== undefined;

  if (
    existingAssessment?.token &&
    !hasVendorSnapshotOverride
  ) {
    let existingRun =
      await prisma.assessmentRun.findFirst({
        where: {
          assessmentId: existingAssessment.id,
        },
        orderBy: {
          id: "desc",
        },
        select: {
          id: true,
        },
      });

    if (!existingRun) {
      const insertedRuns = await insertAssessmentLaunchRun({
        organizationId: vendor.organizationId,
        vendorId: vendor.id,
        assessmentId: existingAssessment.id,
        templateId: template.id,
        startedAt: now,
      });

      existingRun = insertedRuns[0] ?? null;
    }

    return createSuccessResult({
      assessmentId: existingAssessment.id,
      assessmentRunId:
        existingRun?.id ?? null,
      token: existingAssessment.token,
      reused: true,
    });
  }

  const token = generateToken();

  const assessment =
    await prisma.assessment.create({
      data: {
        organizationId: vendor.organizationId,
        vendorId: vendor.id,
        templateId: template.id,
        status: "LAUNCHED" as any,
        title:
          input.title?.trim() ||
          `${template.name} for ${vendor.name}`,
        dueAt: input.dueAt ?? null,
        token,
        vendorEmail:
          input.vendorEmailOverride !== undefined
            ? input.vendorEmailOverride?.trim().toLowerCase() || null
            : vendor.contactEmail,
        vendorContactName:
          input.vendorContactNameOverride !== undefined
            ? input.vendorContactNameOverride?.trim() || null
            : vendor.contactName,
        launchedAt: now,
        startedAt: now,
        completionPercent: 0,
        isVendorSubmitted: false,
      } as any,
      select: {
        id: true,
        token: true,
      },
    });

  if (!assessment.token) {
    throw new Error(
      "Assessment launch completed without a vendor portal token.",
    );
  }

  const insertedRuns = await insertAssessmentLaunchRun({
    organizationId: vendor.organizationId,
    vendorId: vendor.id,
    assessmentId: assessment.id,
    templateId: template.id,
    startedAt: now,
  });

  const run = insertedRuns[0];

  if (!run) {
    throw new Error(
      "Assessment launch failed to create an assessment run.",
    );
  }

  return createSuccessResult({
    assessmentId: assessment.id,
    assessmentRunId: run.id,
    token: assessment.token,
    reused: false,
  });
}
