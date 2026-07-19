import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { createOrgNotification } from "@/lib/notifications/create-notification";
import { normalizeOrganizationPlanTier } from "@/lib/billing/organization-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params: Promise<{ orgId: string }>;
};

type BodyMap = Record<string, unknown>;

function isOpsUser(userId: string | null | undefined) {
  if (!userId) return false;

  const allowlist = String(process.env.TRUVERN_OPS_USERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return allowlist.includes(userId);
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

async function readBody(request: Request): Promise<BodyMap> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json().catch(() => ({}));
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) return {};

  return Object.fromEntries(formData.entries());
}

function redirectBack(request: Request, organizationId: number, status: string) {
  return NextResponse.redirect(
    new URL(`/truvern/ops/funding/${organizationId}?status=${status}`, request.url),
    303,
  );
}

export async function POST(request: Request, context: Params) {
  const { userId } = await auth();

  const { orgId } = await context.params;
  const organizationId = Number(orgId);

  if (!isOpsUser(userId)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized ops user." },
      { status: 403 },
    );
  }

  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid organization id." },
      { status: 400 },
    );
  }

  const body = await readBody(request);

  const planTier = normalizeOrganizationPlanTier(body.planTier);
  const reason = String(body.reason || "Ops plan override").trim();
  const startsAt = parseDate(body.startsAt) || new Date();
  const expiresAt = parseDate(body.expiresAt);
  const revokeExisting = body.revokeExisting !== "false";

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });

  if (!organization) {
    return NextResponse.json(
      { ok: false, error: "Organization not found." },
      { status: 404 },
    );
  }

  await prisma.$transaction(async (tx) => {
    if (revokeExisting) {
      await tx.organizationPlanOverride.updateMany({
        where: {
          organizationId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    await tx.organizationPlanOverride.create({
      data: {
        organizationId,
        planTier,
        reason,
        createdByUserId: userId,
        startsAt,
        expiresAt,
      },
    });
  });

    await createOrgNotification({
    organizationId,
    type: "PLAN_OVERRIDE_APPLIED",
    severity: planTier === "ENTERPRISE" ? "WARNING" : "SUCCESS",
    title: "Plan override applied",
    message: `This organization was temporarily enabled for ${planTier}.`,
    href: `/billing/plans`,
    metadataJson: {
      organizationId,
      planTier,
      reason,
      source: "truvern_ops",
    },
  });

  return redirectBack(request, organizationId, "plan-override-applied");
}

export async function DELETE(request: Request, context: Params) {
  const { userId } = await auth();

  if (!isOpsUser(userId)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized ops user." },
      { status: 403 },
    );
  }

  const { orgId } = await context.params;
  const organizationId = Number(orgId);

  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid organization id." },
      { status: 400 },
    );
  }

  const updated = await prisma.organizationPlanOverride.updateMany({
    where: {
      organizationId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    revokedCount: updated.count,
  });
}



