import prisma from "@/lib/prisma";
import { reverseReviewCredits } from "@/lib/services/review-credit-ledger-service";

function safeStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function upper(value: unknown) {
  return safeStr(value).toUpperCase();
}

type ReopenAssessmentRunInput = {
  assessmentRunId: number;
  actorUserId: string | null;
};

export type ReopenAssessmentRunResult = {
  status: number;
  body: Record<string, unknown>;
};

type AssessmentRunRow = {
  id: number;
  organizationId: number;
  vendorId: number;
  status: string;
};

type ReviewRow = {
  assignmentId: number;
  responseId: number | null;
  assignmentStatus: string | null;
  releaseState: string | null;
  intent: string | null;
};

async function reverseReservedCreditsForAssignment(input: {
  organizationId: number;
  assessmentRunId: number;
  assignmentId: number;
  actorUserId: string | null;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const assignmentRows = await tx.$queryRaw<
      Array<{
        reviewRequestId: number | null;
        vendorId: number;
      }>
    >`
      select
        "reviewRequestId",
        "vendorId"
      from "ReviewAssignment"
      where id = ${input.assignmentId}
      limit 1
    `;

    const assignment = assignmentRows[0];

    if (!assignment) {
      return {
        eventKey:
          `assessment-run:${input.assessmentRunId}:review:${input.assignmentId}:reversal`,
        reversedCredits: 0,
        reservedCredits: 0,
        consumedCredits: 0,
        reused: false,
      };
    }

    return reverseReviewCredits(tx, {
      organizationId: input.organizationId,
      assignmentId: input.assignmentId,
      reviewRequestId: assignment.reviewRequestId,
      vendorId: assignment.vendorId,
      actorUserId: input.actorUserId,
      assessmentRunId: input.assessmentRunId,
      source: "assessment_run_reopen",
      reason: input.reason,
      eventKey:
        `assessment-run:${input.assessmentRunId}:review:${input.assignmentId}:reversal`,
      note:
        "Reversed reserved Truvern credits because assessment run was reopened.",
      metadata: {
        assessmentRunId: input.assessmentRunId,
      },
    });
  });
}

export async function reopenAssessmentRun(
  input: ReopenAssessmentRunInput,
): Promise<ReopenAssessmentRunResult> {
  const result = await prisma.$transaction(async (tx) => {
    const runRows = await tx.$queryRaw<AssessmentRunRow[]>`
      select
        id,
        "organizationId",
        "vendorId",
        status::text as status
      from "AssessmentRun"
      where id = ${input.assessmentRunId}
      limit 1
    `;

    const run = runRows[0];

    if (!run) {
      return {
        status: 404,
        body: {
          ok: false,
          error: "Assessment run not found.",
        },
        run: null,
        reversalAssignments: [] as number[],
      };
    }

    await tx.$executeRaw`
      select pg_advisory_xact_lock(
        ${run.organizationId}::int,
        ${run.id}::int
      )
    `;

    const reviewRows = await tx.$queryRaw<ReviewRow[]>`
      select
        ra.id as "assignmentId",
        rr.id as "responseId",
        ra.status::text as "assignmentStatus",
        rr.responses->>'releaseState' as "releaseState",
        rr.responses->>'intent' as intent
      from "ReviewAssignment" ra
      join "ReviewRequest" req on req.id = ra."reviewRequestId"
      left join lateral (
        select id, responses
        from "ReviewResponse"
        where "reviewAssignmentId" = ra.id
        order by "updatedAt" desc
        limit 1
      ) rr on true
      where req."organizationId" = ${run.organizationId}
        and req."vendorId" = ${run.vendorId}
        and (
          lower(coalesce(ra.note, '')) like '%truvern%'
          or lower(coalesce(req.title, '')) like '%truvern%'
          or lower(coalesce(req.note, '')) like '%truvern%'
          or upper(coalesce(rr.responses->>'assignmentType', '')) = 'TRUVERN'
        )
      order by ra."updatedAt" desc, ra.id desc
    `;

    const lockedReview = reviewRows.find((row) => {
      const releaseState = upper(row.releaseState);
      const intent = upper(row.intent);

      return (
        releaseState === "RELEASED" ||
        releaseState === "CONFIRMED" ||
        intent === "RELEASE"
      );
    });

    if (lockedReview) {
      return {
        status: 409,
        body: {
          ok: false,
          error:
            "This assessment cannot be reopened because a Truvern governance outcome has already been released or confirmed.",
          assignmentId: lockedReview.assignmentId,
          releaseState: lockedReview.releaseState,
        },
        run: null,
        reversalAssignments: [] as number[],
      };
    }

    await tx.$executeRaw`
      update "AssessmentRun"
      set
        status = 'IN_PROGRESS'::"AssessmentStatus",
        "submittedAt" = null,
        "completedAt" = null,
        "updatedAt" = now()
      where id = ${run.id}
    `;

    const reversalAssignments = reviewRows.map(
      (row) => row.assignmentId,
    );

    return {
      status: 200,
      body: {
        ok: true,
        assessmentRunId: run.id,
        previousStatus: run.status,
        status: "IN_PROGRESS",
        relatedReviewAssignments: reversalAssignments,
      },
      reversalAssignments,
      run,
    };
  });

  if (result.status !== 200) {
    return {
      status: result.status,
      body: result.body,
    };
  }

  if (!result.run) {
    return {
      status: 500,
      body: {
        ok: false,
        error:
          "Assessment run context was not returned from reopen transaction.",
      },
    };
  }

  const reversals: Array<Record<string, unknown>> = [];

  for (const assignmentId of result.reversalAssignments) {
    const reversal = await reverseReservedCreditsForAssignment({
      organizationId: result.run.organizationId,
      assessmentRunId: result.run.id,
      assignmentId,
      actorUserId: input.actorUserId,
      reason: "assessment_run_reopened",
    });

    reversals.push({
      assignmentId,
      ...reversal,
    });
  }

  return {
    status: 200,
    body: {
      ...result.body,
      creditReversals: reversals,
    },
  };
}

