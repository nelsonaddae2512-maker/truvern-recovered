import {
  NextRequest,
  NextResponse,
} from "next/server";
import prisma from "@/lib/prisma";
import {
  isTruvernOperator,
} from "@/lib/truvern-ops-access";
import {
  readTruvernReviewTemplateSelection,
} from "@/lib/repositories/truvern-review-template-repository";
import {
  launchAssessment,
} from "@/lib/services/assessment-launch-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CONFIRMATION =
  "CREATE-R55-CONTROLLED-ASSESSMENT";

function json(
  status: number,
  body: Record<string, unknown>,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function positiveInteger(
  value: unknown,
): number | null {
  const parsed =
    Number(
      String(value ?? "").trim(),
    );

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

function normalizeEmail(
  value: unknown,
): string | null {
  const normalized =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (
    !normalized ||
    !normalized.includes("@")
  ) {
    return null;
  }

  return normalized;
}

function maskEmail(
  value: string,
): string {
  const at = value.indexOf("@");

  if (at <= 0) {
    return "***";
  }

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);

  return `${
    local.length <= 1
      ? "*"
      : `${local[0]}***`
  }@${domain}`;
}

export async function POST(
  request: NextRequest,
) {
  const authorized =
    await isTruvernOperator();

  if (!authorized) {
    return json(403, {
      error: "Not authorized.",
    });
  }

  let body: Record<string, unknown>;

  try {
    body =
      (await request.json()) as
        Record<string, unknown>;
  } catch {
    return json(400, {
      error: "Valid JSON body required.",
    });
  }

  if (body.confirmation !== CONFIRMATION) {
    return json(400, {
      error:
        `confirmation must equal ${CONFIRMATION}.`,
    });
  }

  const organizationId =
    positiveInteger(body.organizationId);

  const vendorId =
    positiveInteger(body.vendorId);

  const templateId =
    positiveInteger(body.templateId);

  const recipientEmail =
    normalizeEmail(body.recipientEmail);

  const recipientName =
    String(
      body.recipientName ?? "",
    ).trim() || null;

  if (
    !organizationId ||
    !vendorId ||
    !templateId ||
    !recipientEmail
  ) {
    return json(400, {
      error:
        "Valid organizationId, vendorId, templateId, and recipientEmail are required.",
    });
  }

  const organization =
    await prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        id: true,
        name: true,
        planTier: true,
      },
    });

  if (!organization) {
    return json(404, {
      error: "Organization not found.",
    });
  }

  const vendor =
    await prisma.vendor.findFirst({
      where: {
        id: vendorId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
      },
    });

  if (!vendor) {
    return json(404, {
      error:
        "Vendor not found in organization.",
    });
  }

  const template =
    await readTruvernReviewTemplateSelection({
      templateId,
      organizationId,
    });

  if (!template) {
    return json(404, {
      error:
        "Valid Truvern Review template not found.",
    });
  }

  const existingAssessmentCount =
    await prisma.assessment.count({
      where: {
        organizationId,
        vendorId,
        templateId,
      },
    });

  if (existingAssessmentCount !== 0) {
    return json(409, {
      error:
        "Controlled canary requires zero existing matching assessments.",
      existingAssessmentCount,
    });
  }

  const activeAssignmentCount =
    await prisma.reviewAssignment.count({
      where: {
        organizationId,
        vendorId,
        status: {
          in: [
            "PENDING",
            "IN_PROGRESS",
          ] as any,
        },
      } as any,
    });

  if (activeAssignmentCount !== 0) {
    return json(409, {
      error:
        "Controlled canary requires zero active review assignments.",
      activeAssignmentCount,
    });
  }

  const result =
    await launchAssessment({
      vendorId,
      templateId,
      currentPlanTier:
        String(
          organization.planTier ??
            "ENTERPRISE",
        ),
      title:
        `R55 Production Commercial Canary - ${vendor.name}`,
      vendorEmailOverride:
        recipientEmail,
      vendorContactNameOverride:
        recipientName,
    });

  if (!result.ok) {
    return json(result.status, {
      error: result.error,
    });
  }

  if (result.reused) {
    return json(409, {
      error:
        "Controlled assessment unexpectedly reused an existing assessment.",
    });
  }

  return json(201, {
    ok: true,
    organizationId:
      organization.id,
    vendorId:
      vendor.id,
    templateId:
      template.id,
    assessmentId:
      result.assessmentId,
    assessmentRunId:
      result.assessmentRunId,
    reused:
      result.reused,
    recipientConfigured: true,
    recipientMasked:
      maskEmail(recipientEmail),
    vendorRecordMutated: false,
    reviewAssignmentCreated: false,
    creditReserved: false,
    emailSent: false,
    vendorPortalOpened: false,
  });
}