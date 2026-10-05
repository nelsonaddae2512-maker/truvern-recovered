import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  await requireOpsAccess();

  const { id: rawId } = await context.params;
  const assessmentId = Number(rawId);

  if (
    !Number.isInteger(assessmentId) ||
    assessmentId <= 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid framework assessment id.",
      },
      {
        status: 400,
      },
    );
  }

  const assessment =
    await prisma.truvernFrameworkAssessment.findUnique({
      where: {
        id: assessmentId,
      },
      select: {
        id: true,
        status: true,

        framework: {
          select: {
            id: true,
          },
        },

        organizationId: true,
        vendorId: true,
        assessmentRunId: true,
        reviewAssignmentId: true,

        sentAt: true,
        submittedAt: true,
        readyForReleaseAt: true,
        releasedAt: true,

        responses: {
          select: {
            id: true,
          },
        },
      },
    });

  if (!assessment) {
    return NextResponse.json(
      {
        ok: false,
        assessmentId,
        error: "Framework assessment not found.",
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,

      assessment: {
        id: assessment.id,
        frameworkId: assessment.framework.id,
        organizationId:
          assessment.organizationId ?? null,
        vendorId:
          assessment.vendorId ?? null,
        assessmentRunId:
          assessment.assessmentRunId ?? null,
        reviewAssignmentId:
          assessment.reviewAssignmentId ?? null,

        status: assessment.status,

        sentAt:
          assessment.sentAt ?? null,
        submittedAt:
          assessment.submittedAt ?? null,
        readyForReleaseAt:
          assessment.readyForReleaseAt ?? null,
        releasedAt:
          assessment.releasedAt ?? null,

        responseCount:
          assessment.responses.length,
      },

      mutations: {
        assessmentCreated: false,
        assessmentUpdated: false,
        responsesUpdated: false,
        auditWritten: false,
        communicationSent: false,
        tokenChanged: false,
        creditChanged: false,
      },
    },
    {
      status: 200,
    },
  );
}
