import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { governanceAuthErrorResponse, governanceForbidden } from "@/lib/auth/governance-auth-errors";
import { AssessmentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import {
  getGovernanceActor,
  requireGovernanceCapability,
} from "@/lib/auth/truvern-governance";
import { findFirstAssessment, updateAssessment } from "@/lib/repositories/assessment-repository";
import { updateManyAssessmentRuns } from "@/lib/repositories/assessment-run-repository";
import { cancelLatestReviewResponsesForVendor } from "@/lib/repositories/portal-controls-repository";

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

    const actor = await getGovernanceActor();
    requireGovernanceCapability(actor, "assessment.manage");

    if ("_needsOrgSelection" in org) {
      return NextResponse.json(
        { ok: false, error: "Select an organization first." },
        { status: 400 },
      );
    }

    if (
      actor.role !== "OPS" &&
      (
        actor.organizationId == null ||
        actor.organizationId !== org.id
      )
    ) {
      throw governanceForbidden(
        "You do not have access to this organization.",
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    const assessment = await findFirstAssessment({
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
      const updated = await updateAssessment({
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
        const nextAssessment = await updateAssessment({
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
        }, tx);

        await updateManyAssessmentRuns({
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
        }, tx);        await cancelLatestReviewResponsesForVendor(
          nextAssessment.vendorId,
          tx,
        );
return nextAssessment;
      });

      return NextResponse.json({ ok: true, action, assessment: updated });
    }

    if (action === "regenerate") {
      const updated = await updateAssessment({
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
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    console.error("POST /api/assessments/[id]/portal-controls failed", error);

    return NextResponse.json(
      { ok: false, error: "Failed to update portal lifecycle." },
      { status: 500 },
    );
  }
}




