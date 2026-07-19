import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function upper(v: unknown) {
  return safeStr(v).toUpperCase();
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

async function reverseReservedCreditsForAssignment(input: {
  organizationId: number;
  assessmentRunId: number;
  assignmentId: number;
  actorUserId: string | null;
  reason: string;
}) {
  const eventKey = `assessment-run:${input.assessmentRunId}:review:${input.assignmentId}:reversal`;

  const existingRows: Array<{ count: number }> = await prisma.$queryRawUnsafe(
    `
    select count(*)::int as count
    from "TruvernCreditLedgerEntry"
    where "eventKey" = $1
      and status = 'POSTED'::text
    `,
    eventKey,
  );

  if (Number(existingRows?.[0]?.count ?? 0) > 0) {
    return {
      reversed: false,
      alreadyReversed: true,
      eventKey,
    };
  }

  const balanceRows: Array<{
    reservedCredits: number;
    consumedCredits: number;
  }> = await prisma.$queryRawUnsafe(
    `
    select
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
      coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = $1
      and "reviewAssignmentId" = $2
      and status = 'POSTED'::text
    `,
    input.organizationId,
    input.assignmentId,
  );

  const reservedCredits = Number(balanceRows?.[0]?.reservedCredits ?? 0);
  const consumedCredits = Number(balanceRows?.[0]?.consumedCredits ?? 0);

  if (reservedCredits <= 0 || consumedCredits > 0) {
    return {
      reversed: false,
      alreadyReversed: false,
      reservedCredits,
      consumedCredits,
      eventKey,
    };
  }

  await prisma.$executeRawUnsafe(
    `
    insert into "TruvernCreditLedgerEntry" (
      "organizationId",
      "assessmentRunId",
      "reviewAssignmentId",
      "actorUserId",
      "eventKey",
      "entryType",
      "fundingSource",
      status,
      "availableDelta",
      "reservedDelta",
      "consumedDelta",
      quantity,
      currency,
      "unitPriceCents",
      "amountCents",
      note,
      "metadataJson",
      "createdAt"
    )
    values (
      $1,
      $2,
      $3,
      $4,
      $5,
      'REVERSAL'::"TruvernCreditEntryType",
      'PREPAID_CREDITS'::"TruvernCreditFundingSource",
      'POSTED'::text,
      $6,
      $7,
      0,
      $8,
      null,
      null,
      null,
      $9,
      $10::jsonb,
      now()
    )
    `,
    input.organizationId,
    input.assessmentRunId,
    input.assignmentId,
    input.actorUserId,
    eventKey,
    reservedCredits,
    -reservedCredits,
    reservedCredits,
    `Reversed ${reservedCredits} reserved Truvern credit${reservedCredits === 1 ? "" : "s"} because assessment run was reopened.`,
    JSON.stringify({
      source: "assessment_run_reopen",
      reason: input.reason,
      assessmentRunId: input.assessmentRunId,
      assignmentId: input.assignmentId,
      reversedCredits: reservedCredits,
    }),
  );

  return {
    reversed: true,
    alreadyReversed: false,
    reservedCredits,
    consumedCredits,
    eventKey,
  };
}

export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { userId } = await auth();
    const params = await ctx.params;
    const assessmentRunId = safeInt(params?.id);

    if (!assessmentRunId) {
      return json(400, { ok: false, error: "Invalid assessment run id." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const runRows: Array<{
        id: number;
        organizationId: number;
        vendorId: number;
        status: string;
      }> = await tx.$queryRawUnsafe(
        `
        select
          id,
          "organizationId",
          "vendorId",
          status::text as status
        from "AssessmentRun"
        where id = $1
        limit 1
        `,
        assessmentRunId,
      );

      const run = runRows[0];

      if (!run) {
        return {
          status: 404,
          body: { ok: false, error: "Assessment run not found." },
        };
      }

      await tx.$executeRawUnsafe(
        `select pg_advisory_xact_lock($1::int, $2::int)`,
        run.organizationId,
        run.id,
      );

      const reviewRows: Array<{
        assignmentId: number;
        responseId: number | null;
        assignmentStatus: string | null;
        releaseState: string | null;
        intent: string | null;
      }> = await tx.$queryRawUnsafe(
        `
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
        where req."organizationId" = $1
          and req."vendorId" = $2
          and (
            lower(coalesce(ra.note, '')) like '%truvern%'
            or lower(coalesce(req.title, '')) like '%truvern%'
            or lower(coalesce(req.note, '')) like '%truvern%'
            or upper(coalesce(rr.responses->>'assignmentType', '')) = 'TRUVERN'
          )
        order by ra."updatedAt" desc, ra.id desc
        `,
        run.organizationId,
        run.vendorId,
      );

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
        };
      }

      await tx.$executeRawUnsafe(
        `
        update "AssessmentRun"
        set
          status = 'IN_PROGRESS'::"AssessmentStatus",
          "submittedAt" = null,
          "completedAt" = null,
          "updatedAt" = now()
        where id = $1
        `,
        run.id,
      );

      return {
        status: 200,
        body: {
          ok: true,
          assessmentRunId: run.id,
          previousStatus: run.status,
          status: "IN_PROGRESS",
          relatedReviewAssignments: reviewRows.map((row) => row.assignmentId),
        },
        reversalAssignments: reviewRows.map((row) => row.assignmentId),
        run,
      };
    });

    if (result.status !== 200) {
  return json(result.status, result.body);
}

if (!result.run) {
  return json(500, {
    ok: false,
    error: "Assessment run context was not returned from reopen transaction.",
  });
}

const reversalAssignments = Array.isArray(result.reversalAssignments)
  ? result.reversalAssignments
  : [];

const reversals = [];

for (const assignmentId of reversalAssignments) {
      const reversal = await reverseReservedCreditsForAssignment({
        organizationId: result.run.organizationId,
        assessmentRunId: result.run.id,
        assignmentId,
        actorUserId: userId,
        reason: "assessment_run_reopened",
      });

      reversals.push({
        assignmentId,
        ...reversal,
      });
    }

    return json(200, {
      ...result.body,
      creditReversals: reversals,
    });
  } catch (error: any) {
    return json(500, {
      ok: false,
      error: safeStr(error?.message) || "Failed to reopen assessment run.",
    });
  }
}


