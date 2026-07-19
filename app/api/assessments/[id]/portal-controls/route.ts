import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { AssessmentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function parseId(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function newToken() {
  return randomBytes(24).toString("hex");
}

export async function POST(request: Request, { params }: Props) {
  try {
    const resolvedParams = await params;
    const assessmentId = parseId(resolvedParams.id);

    if (!assessmentId) {
      return NextResponse.json(
        { ok: false, error: "Assessment id required." },
        { status: 400 },
      );
    }

    const org = await requireDbOrganization();

    if ("_needsOrgSelection" in org) {
      return NextResponse.json(
        { ok: false, error: "Select an organization first." },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        vendor: {
          organizationId: org.id,
        },
      },
      select: {
        id: true,
        status: true,
        token: true,
      },
    });

    if (!assessment) {
      return NextResponse.json(
        { ok: false, error: "Assessment not found." },
        { status: 404 },
      );
    }

    if (action === "revoke") {
      const updated = await prisma.assessment.update({
        where: { id: assessment.id },
        data: {
          token: null,
        },
        select: {
          id: true,
          status: true,
          token: true,
        },
      });

      return NextResponse.json({ ok: true, action, assessment: updated });
    }

    if (action === "cancel") {
      const updated = await prisma.$transaction(async (tx) => {
        const nextAssessment = await tx.assessment.update({
          where: { id: assessment.id },
          data: {
            token: null,
            status: AssessmentStatus.ARCHIVED,
          },
          select: {
            id: true,
            status: true,
            token: true,
            vendorId: true,
          },
        });

        await tx.assessmentRun.updateMany({
          where: {
            vendorId: nextAssessment.vendorId,
            status: {
              in: [
                AssessmentStatus.DRAFT,
                AssessmentStatus.LAUNCHED,
                AssessmentStatus.IN_PROGRESS,
                AssessmentStatus.REVIEW_READY,
                AssessmentStatus.UNDER_REVIEW,
              ],
            },
          },
          data: {
            status: AssessmentStatus.ARCHIVED,
          },
        });        await tx.$executeRawUnsafe(
          `
          update "ReviewResponse" rr
          set responses =
            coalesce(rr.responses, '{}'::jsonb)
            || jsonb_build_object(
              'releaseState', 'CANCELLED',
              'cancelledAt', now()::text,
              'cancellationReason', 'Assessment cancelled from vendor portal lifecycle controls.'
            )
          where rr.id in (
            select latest.id
            from "ReviewAssignment" ra
            join lateral (
              select r.id
              from "ReviewResponse" r
              where r."reviewAssignmentId" = ra.id
              order by r."updatedAt" desc, r.id desc
              limit 1
            ) latest on true
            left join "ReviewRequest" req on req.id = ra."reviewRequestId"
            where coalesce(req."vendorId", ra."vendorId") = $1
              and ra.status::text in ('PENDING', 'IN_PROGRESS', 'SUBMITTED')
          )
          `,
          nextAssessment.vendorId,
        );
return nextAssessment;
      });

      return NextResponse.json({ ok: true, action, assessment: updated });
    }

    if (action === "regenerate") {
      const updated = await prisma.assessment.update({
        where: { id: assessment.id },
        data: {
          token: newToken(),
        },
        select: {
          id: true,
          status: true,
          token: true,
        },
      });

      return NextResponse.json({ ok: true, action, assessment: updated });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported portal control action." },
      { status: 400 },
    );
  } catch (error) {
    console.error("POST /api/assessments/[id]/portal-controls failed", error);

    return NextResponse.json(
      { ok: false, error: "Failed to update portal lifecycle." },
      { status: 500 },
    );
  }
}




