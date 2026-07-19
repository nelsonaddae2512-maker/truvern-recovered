import crypto from "crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import { canAccessTier, getCurrentOrgPlanTier } from "@/lib/billing/plan-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "cache-control": "no-store" } },
      ),
    };
  }

  try {
    const org = await requireDbOrganization();

    return {
      ok: true as const,
      userId,
      org,
    };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Organization required" },
        { status: 403, headers: { "cache-control": "no-store" } },
      ),
    };
  }
}

type Params = {
  params: Promise<{ id: string }> | { id: string };
};

function parseId(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

function parseDueAt(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const date = new Date(`${raw}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: Request, { params }: Params) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

const resolvedParams = await params;
  const vendorId = parseId(resolvedParams.id);

  if (!vendorId) {
    return NextResponse.json({ ok: false, error: "Invalid vendor id." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const templateId = parseId(body.templateId);
  const title = String(body.title || "").trim();
  const dueAt = parseDueAt(body.dueAt);
if (!templateId) {
    return NextResponse.json({ ok: false, error: "Template is required." }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      contactName: true,
      contactEmail: true,
    },
  });

  if (!vendor) {
    return NextResponse.json({ ok: false, error: "Vendor not found." }, { status: 404 });
  }

  const templateRows: any[] = await prisma.$queryRawUnsafe(
    `
    select
      id,
      name,
      "accessTier"::text as "accessTier",
      source::text as source,
      origin::text as origin,
      "isSystem",
      "isActive"
    from "AssessmentTemplate"
    where id = $1
    limit 1
    `,
    templateId,
  );

  const template = templateRows[0] || null;

  // API_FREE_TRUVERN_NIST_LAUNCH_GATE
  const currentPlanTier = await getCurrentOrgPlanTier();
  if (
    currentPlanTier === "FREE" &&
    template?.name === "Truvern NIST 800-53 Governance Review"
  ) {
    return NextResponse.json(
      {
        error:
          "This assessment requires a Pro or Enterprise membership. Free users may preview it but cannot launch it.",
      },
      { status: 403 },
    );
  }

  if (!template || !template.isActive) {
    return NextResponse.json({ ok: false, error: "Template not found or inactive." }, { status: 404 });
  }

  const now = new Date();

  const existingAssessment = await prisma.assessment.findFirst({
    where: {
      organizationId: vendor.organizationId,
      vendorId: vendor.id,
      templateId: template.id,
      isVendorSubmitted: false,
      status: {
        in: ["LAUNCHED", "IN_PROGRESS", "DRAFT"] as any,
      },
    } as any,
    orderBy: {
      id: "desc",
    },
    select: {
      id: true,
      token: true,
      title: true,
    },
  });

  if (existingAssessment?.token) {

    let existingRun = await prisma.assessmentRun.findFirst({
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
      const insertedRuns = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
        `insert into "AssessmentRun" (
          "organizationId",
          "vendorId",
          "assessmentId",
          "templateId",
          "status",
          "startedAt",
          "createdAt",
          "updatedAt"
        )
        values ($1, $2, $3, $4, $5::"AssessmentStatus", $6, $6, $6)
        returning "id"`,
        vendor.organizationId,
        vendor.id,
        existingAssessment.id,
        template.id,
        "LAUNCHED",
        now,
      );

      existingRun = insertedRuns[0];
    }

    return NextResponse.json({
      ok: true,
      reused: true,
      id: existingAssessment.id,
      assessmentId: existingAssessment.id,
      assessmentRunId: existingRun?.id ?? null,
      token: existingAssessment.token,
      vendorUrl: `/vendor-assessment/${existingAssessment.token}`,
      redirectUrl: `/assessments/${existingAssessment.id}/launch`,
    });
  }

  const token = generateToken();

  const assessment = await prisma.assessment.create({
    data: {
      organizationId: vendor.organizationId,
      vendorId: vendor.id,
      templateId: template.id,
      status: "LAUNCHED" as any,
      title: title || `${template.name} for ${vendor.name}`,
      dueAt,
      token,
      vendorEmail: vendor.contactEmail,
      vendorContactName: vendor.contactName,
      launchedAt: now,
      startedAt: now,
      completionPercent: 0,
      isVendorSubmitted: false,
    } as any,
    select: {
      id: true,
      token: true,
      title: true,
    },
  });

  const insertedRuns = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `insert into "AssessmentRun" (
      "organizationId",
      "vendorId",
      "assessmentId",
      "templateId",
      "status",
      "startedAt",
      "createdAt",
      "updatedAt"
    )
    values ($1, $2, $3, $4, $5::"AssessmentStatus", $6, $6, $6)
    returning "id"`,
    vendor.organizationId,
    vendor.id,
    assessment.id,
    template.id,
    "LAUNCHED",
    now,
  );

  const run = insertedRuns[0];
return NextResponse.json({
    ok: true,
    id: assessment.id,
    assessmentId: assessment.id,
    assessmentRunId: run.id,
    token: assessment.token,
    vendorUrl: `/vendor-assessment/${assessment.token}`,
    redirectUrl: `/assessments/${assessment.id}/launch`,
  });
}













