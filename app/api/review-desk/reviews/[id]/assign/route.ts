import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

function parseId(v: unknown) {
  const m = String(v ?? "").match(/\d+/);
  if (!m) return null;

  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function truvernOpsUserIds() {
  return String(process.env.TRUVERN_OPS_USERS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function reviewCreditCost() {
  return parseId(process.env.TRUVERN_REVIEW_CREDIT_COST) ?? 1;
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  });
}

export async function POST(req: Request, context: RouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return json(401, {
      ok: false,
      error: "Unauthorized",
    });
  }

  const params = await context.params;
  const assignmentId = parseId(params?.id);

  if (!assignmentId) {
    return json(400, {
      ok: false,
      error: "Invalid assignment id",
    });
  }

  const body = await req.json().catch(() => ({}));
  const action = safeStr(body?.action).toLowerCase();
  const reviewerUserId = safeStr(body?.reviewerUserId);
  const reviewerName = safeStr(body?.reviewerName);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw<
      Array<{
        id: number;
        organizationId: number;
        vendorId: number;
        reviewRequestId: number | null;
        status: string | null;
        assignmentType: string | null;
        reviewerUserId: string | null;
        startedAt: Date | null;
        claimedAt: Date | null;
        submittedAt: Date | null;
        requestTitle: string | null;
      }>
    >`
      select
        ra.id,
        ra."organizationId",
        ra."vendorId",
        ra."reviewRequestId",
        ra.status::text as status,
        ra."assignmentType"::text as "assignmentType",
        ra."reviewerUserId",
        ra."startedAt",
        ra."claimedAt",
        ra."submittedAt",
        req.title as "requestTitle"
      from "ReviewAssignment" ra
      left join "ReviewRequest" req on req.id = ra."reviewRequestId"
      where ra.id = ${assignmentId}
      limit 1
    `;

    const assignment = existing[0];

    if (!assignment) {
      return {
        status: 404,
        body: {
          ok: false,
          error: "Assignment not found",
        },
      };
    }

    await tx.$executeRawUnsafe(
      `select pg_advisory_xact_lock($1::int, $2::int)`,
      assignment.organizationId,
      assignment.id,
    );

    if (action === "unassign") {
      const isTruvern =
        safeStr(assignment.assignmentType).toUpperCase() === "TRUVERN";

      const started =
        safeStr(assignment.status).toUpperCase() !== "PENDING" ||
        Boolean(assignment.reviewerUserId) ||
        Boolean(assignment.startedAt) ||
        Boolean(assignment.claimedAt) ||
        Boolean(assignment.submittedAt);

      if (isTruvern && started) {
        return {
          status: 409,
          body: {
            ok: false,
            code: "TRUVERN_REVIEW_ALREADY_STARTED",
            error:
              "This Truvern review has already started and cannot be unassigned.",
          },
        };
      }

      let creditReversal: Record<string, unknown> | null = null;

      if (isTruvern) {
        const reservationRows: Array<{ reservedCredits: number }> =
          await tx.$queryRawUnsafe(
            `
            select coalesce(sum("reservedDelta"), 0)::int as "reservedCredits"
            from "TruvernCreditLedgerEntry"
            where "organizationId" = $1
              and "reviewAssignmentId" = $2
              and status = 'POSTED'::text
            `,
            assignment.organizationId,
            assignment.id,
          );

        const reservedCredits = Number(
          reservationRows?.[0]?.reservedCredits ?? 0,
        );

        if (reservedCredits > 0) {
          const eventKey = `review:${assignment.id}:reservation_reversal:${Date.now()}`;

          await tx.$executeRawUnsafe(
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
            select
              $1,
              null,
              $2,
              $3,
              $4,
              'REVERSAL'::"TruvernCreditEntryType",
              'PREPAID_CREDITS'::"TruvernCreditFundingSource",
              'POSTED'::text,
              $5,
              $6,
              0,
              $7,
              null,
              null,
              null,
              $8,
              $9::jsonb,
              now()
            where not exists (
              select 1
              from "TruvernCreditLedgerEntry"
              where "eventKey" = $4
            )
            `,
            assignment.organizationId,
            assignment.id,
            userId,
            eventKey,
            reservedCredits,
            -reservedCredits,
            reservedCredits,
            `Reversed ${reservedCredits} reserved Truvern credit${reservedCredits === 1 ? "" : "s"} after unassigning pending review.`,
            JSON.stringify({
              source: "review_assignment_unassign",
              assignmentId: assignment.id,
              vendorId: assignment.vendorId,
              reviewRequestId: assignment.reviewRequestId,
              reversedCredits: reservedCredits,
            }),
          );

          creditReversal = {
            eventKey,
            reversedCredits: reservedCredits,
          };
        }
      }

      await tx.$executeRaw`
        update "ReviewAssignment"
        set
          "assignmentType" = 'INTERNAL',
          "reviewerUserId" = null,
          "assignedReviewerName" = null,
          "reviewerName" = null,
          "assignedTo" = null,
          "startedAt" = null,
          "claimedAt" = null,
          "updatedAt" = now(),
          status = 'PENDING'::text
        where id = ${assignmentId}
      `;

      return {
        status: 200,
        body: {
          ok: true,
          assignmentId,
          action: "unassign",
          creditReversal,
        },
      };
    }

    if (action === "assign") {
      if (!reviewerUserId) {
        return {
          status: 400,
          body: {
            ok: false,
            error: "Reviewer user id required",
          },
        };
      }

      const actor = await currentUser();
      const fallbackName = safeStr(actor?.fullName) || "Internal reviewer";
      const resolvedName = reviewerName || fallbackName;

      await tx.$executeRaw`
        update "ReviewAssignment"
        set
          "reviewerUserId" = ${reviewerUserId},
          "assignedReviewerName" = ${resolvedName},
          "reviewerName" = ${resolvedName},
          "assignedTo" = ${resolvedName},
          "startedAt" = coalesce("startedAt", now()),
          "claimedAt" = coalesce("claimedAt", now()),
          "updatedAt" = now(),
          status = 'IN_PROGRESS'::text
        where id = ${assignmentId}
      `;

      return {
        status: 200,
        body: {
          ok: true,
          assignmentId,
          action: "assign",
          reviewerUserId,
          reviewerName: resolvedName,
        },
      };
    }

    if (action === "truvern") {
      const alreadyStarted =
        safeStr(assignment.status).toUpperCase() !== "PENDING" ||
        Boolean(assignment.startedAt) ||
        Boolean(assignment.claimedAt) ||
        Boolean(assignment.submittedAt);

      if (alreadyStarted) {
        return {
          status: 409,
          body: {
            ok: false,
            code: "REVIEW_ALREADY_STARTED",
            error:
              "This review has already started and cannot be routed to Truvern.",
          },
        };
      }

      const cost = reviewCreditCost();

      const balanceRows: Array<{ availableCredits: number }> =
        await tx.$queryRawUnsafe(
          `
          select coalesce(sum("availableDelta"), 0)::int as "availableCredits"
          from "TruvernCreditLedgerEntry"
          where "organizationId" = $1
            and status = 'POSTED'::text
          `,
          assignment.organizationId,
        );

      const availableCredits = Number(balanceRows?.[0]?.availableCredits ?? 0);

      if (availableCredits < cost) {
        return {
          status: 402,
          body: {
            ok: false,
            code: "TRUVERN_ACCESS_REQUIRED",
            error:
              "Truvern Expert Review requires available Truvern credits.",
            requiredCredits: cost,
            availableCredits,
            fundingUrl: "/billing/credits",
          },
        };
      }

      const reservationRows: Array<{ reservedCredits: number }> =
        await tx.$queryRawUnsafe(
          `
          select coalesce(sum("reservedDelta"), 0)::int as "reservedCredits"
          from "TruvernCreditLedgerEntry"
          where "organizationId" = $1
            and "reviewAssignmentId" = $2
            and status = 'POSTED'::text
          `,
          assignment.organizationId,
          assignment.id,
        );

      const existingReservedCredits = Number(
        reservationRows?.[0]?.reservedCredits ?? 0,
      );

      let reservation: Record<string, unknown> | null = null;

      if (existingReservedCredits <= 0) {
        const eventKey = `review:${assignment.id}:reservation:${Date.now()}`;

        await tx.$executeRawUnsafe(
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
          select
            $1,
            null,
            $2,
            $3,
            $4,
            'RESERVATION'::"TruvernCreditEntryType",
            'PREPAID_CREDITS'::"TruvernCreditFundingSource",
            'POSTED'::text,
            $5,
            $6,
            0,
            $7,
            null,
            null,
            null,
            $8,
            $9::jsonb,
            now()
          where not exists (
            select 1
            from "TruvernCreditLedgerEntry"
            where "eventKey" = $4
          )
          `,
          assignment.organizationId,
          assignment.id,
          userId,
          eventKey,
          -cost,
          cost,
          cost,
          `Reserved ${cost} Truvern credit${cost === 1 ? "" : "s"} for expert review.`,
          JSON.stringify({
            source: "review_assignment_route_to_truvern",
            assignmentId: assignment.id,
            vendorId: assignment.vendorId,
            reviewRequestId: assignment.reviewRequestId,
            creditCost: cost,
          }),
        );

        reservation = {
          eventKey,
          reservedCredits: cost,
        };
      }

      await tx.$executeRaw`
        update "ReviewAssignment"
        set
          "assignmentType" = 'TRUVERN',
          "reviewerUserId" = null,
          "assignedReviewerName" = 'Truvern expert',
          "reviewerName" = 'Truvern expert',
          "assignedTo" = 'Truvern expert',
          "startedAt" = null,
          "claimedAt" = null,
          "updatedAt" = now(),
          status = 'PENDING'::text
        where id = ${assignmentId}
      `;

      const opsUserIds = truvernOpsUserIds();

      await tx.notification.createMany({
        data: [
          {
            organizationId: assignment.organizationId,
            userId,
            type: "REVIEW_ASSIGNED",
            severity: "INFO",
            title: "Truvern review requested",
            message: `Assignment #${assignment.id} was routed to Truvern Ops for expert review.`,
            href: `/review-desk/reviews/${assignment.id}`,
            metadataJson: {
              audience: "customer",
              assignmentId: assignment.id,
              vendorId: assignment.vendorId,
              reviewRequestId: assignment.reviewRequestId,
            },
          },
          ...opsUserIds.map((opsUserId) => ({
            organizationId: assignment.organizationId,
            userId: opsUserId,
            type: "ASSESSMENT_ASSIGNED_TRUVERN" as const,
            severity: "SUCCESS" as const,
            title: "Truvern received a new review",
            message: `Assignment #${assignment.id} is awaiting Truvern operator claim.`,
            href: `/review-desk/reviews/${assignment.id}`,
            metadataJson: {
              audience: "truvern_ops",
              assignmentId: assignment.id,
              vendorId: assignment.vendorId,
              reviewRequestId: assignment.reviewRequestId,
              customerOrganizationId: assignment.organizationId,
            },
          })),
        ],
      });
return {
        status: 200,
        body: {
          ok: true,
          assignmentId,
          action: "truvern",
          reservation,
        },
      };
    }

    return {
      status: 400,
      body: {
        ok: false,
        error: "Invalid assignment action",
      },
    };
  });

  return json(result.status, result.body);
}












