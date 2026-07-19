import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/create-notification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseOpsUsers() {
  return String(process.env.TRUVERN_OPS_USERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLikelyClerkUserId(value: string) {
  return value.startsWith("user_");
}

export async function POST(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Invalid assessment id." },
      { status: 400 },
    );
  }

  const assessment = await prisma.truvernFrameworkAssessment.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      organizationId: true,
      vendorId: true,
      reviewAssignmentId: true,
      metadata: true,
    },
  });

  if (!assessment) {
    return NextResponse.json(
      { ok: false, error: "Assessment not found." },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();

  await prisma.truvernFrameworkAssessment.update({
    where: { id },
    data: {
      metadata: {
        ...((assessment.metadata || {}) as Record<string, unknown>),
        reopenRequested: true,
        reopenRequestedAt: now,
        reopenRequestSource: "vendor_portal",
      },
    },
  });

  const opsUsers = parseOpsUsers();

  for (const opsUser of opsUsers) {
    await createNotification({
      userId: isLikelyClerkUserId(opsUser) ? opsUser : null,
      organizationId: assessment.organizationId,
      type: "REVIEW_ASSIGNED",
      severity: "WARNING",
      title: `Vendor requested assessment reopen`,
      message: `${assessment.title} needs Truvern Ops review for reopening.`,
      href: assessment.reviewAssignmentId
        ? `/review-desk/${assessment.reviewAssignmentId}`
        : `/vendor-assessments/${assessment.id}`,
      metadataJson: {
        assessmentId: assessment.id,
        vendorId: assessment.vendorId,
        reviewAssignmentId: assessment.reviewAssignmentId,
        reopenRequested: true,
        opsRecipient: opsUser,
      },
    });
  }

  return NextResponse.redirect(
    new URL(`/vendor-assessments/${assessment.id}?reopenRequested=1`, request.url),
    { status: 303 },
  );
}
