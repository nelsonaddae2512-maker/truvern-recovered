import {
  auth,
  currentUser,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  mutateReviewAssignment,
  type ReviewAssignmentAction,
} from "@/lib/services/review-assignment-service";
import { createNotifications } from "@/lib/repositories/notification-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params:
    | Promise<{ id: string }>
    | { id: string };
};

function parseId(
  value: unknown,
): number | null {
  const match =
    String(value ?? "").match(/\d+/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);

  return (
    Number.isFinite(parsed) &&
    parsed > 0
  )
    ? Math.floor(parsed)
    : null;
}

function safeString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function parseAction(
  value: unknown,
): ReviewAssignmentAction | null {
  const action =
    safeString(value).toLowerCase();

  if (
    action === "assign" ||
    action === "truvern" ||
    action === "unassign"
  ) {
    return action;
  }

  return null;
}

function truvernOpsUserIds():
  string[] {
  return String(
    process.env.TRUVERN_OPS_USERS ||
      "",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function json(
  status: number,
  body: Record<string, unknown>,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control":
        "no-store, max-age=0",
    },
  });
}

export async function POST(
  req: Request,
  context: RouteContext,
) {
  const { userId } = await auth();

  if (!userId) {
    return json(401, {
      ok: false,
      error: "Unauthorized",
    });
  }

  const params =
    await context.params;

  const assignmentId =
    parseId(params?.id);

  if (!assignmentId) {
    return json(400, {
      ok: false,
      error:
        "Invalid assignment id",
    });
  }

  const body =
    await req
      .json()
      .catch(() => ({}));

  const action =
    parseAction(body?.action);

  if (!action) {
    return json(400, {
      ok: false,
      error:
        "Invalid assignment action",
    });
  }

  const reviewerUserId =
    safeString(
      body?.reviewerUserId,
    );

  const requestedReviewerName =
    safeString(
      body?.reviewerName,
    );

  let actorName = "";

  if (
    action === "assign" &&
    !requestedReviewerName
  ) {
    const actor =
      await currentUser();

    actorName =
      safeString(actor?.fullName) ||
      "Internal reviewer";
  }

  const result =
    await mutateReviewAssignment({
      assignmentId,
      action,
      actorUserId: userId,
      actorName,
      reviewerUserId,
      reviewerName:
        requestedReviewerName,
      acceptedLegal:
        body?.acceptedLegal === true,
      acceptanceVersion:
        safeString(body?.acceptanceVersion),
    });

  if (!result.ok) {
    return json(
      result.status,
      {
        ok: false,
        error: result.error,
        ...(result.code
          ? {
              code: result.code,
            }
          : {}),
        ...(typeof result.requiredCredits ===
        "number"
          ? {
              requiredCredits:
                result.requiredCredits,
            }
          : {}),
        ...(typeof result.availableCredits ===
        "number"
          ? {
              availableCredits:
                result.availableCredits,
            }
          : {}),
        ...(result.fundingUrl
          ? {
              fundingUrl:
                result.fundingUrl,
            }
          : {}),
      },
    );
  }

  /*
   * Notifications remain transport-level side
   * effects. Assignment and credit mutations have
   * already committed successfully at this point.
   */
  if (result.action === "truvern") {
    const opsUserIds =
      truvernOpsUserIds();

    try {
      await createNotifications({
        data: [
          {
            organizationId:
              result.organizationId,
            userId,
            type:
              "REVIEW_ASSIGNED",
            severity: "INFO",
            title:
              "Truvern review requested",
            message:
              `Assignment #${result.assignmentId} was routed to Truvern Ops for expert review.`,
            href:
              `/review-desk/reviews/${result.assignmentId}`,
            metadataJson: {
              audience: "customer",
              assignmentId:
                result.assignmentId,
              vendorId:
                result.vendorId,
              reviewRequestId:
                result.reviewRequestId,
            },
          },
          ...opsUserIds.map(
            (opsUserId) => ({
              organizationId:
                result.organizationId,
              userId: opsUserId,
              type:
                "ASSESSMENT_ASSIGNED_TRUVERN" as const,
              severity:
                "SUCCESS" as const,
              title:
                "Truvern received a new review",
              message:
                `Assignment #${result.assignmentId} is awaiting Truvern operator claim.`,
              href:
                `/review-desk/reviews/${result.assignmentId}`,
              metadataJson: {
                audience:
                  "truvern_ops",
                assignmentId:
                  result.assignmentId,
                vendorId:
                  result.vendorId,
                reviewRequestId:
                  result.reviewRequestId,
                customerOrganizationId:
                  result.organizationId,
              },
            }),
          ),
        ],
      });
    } catch (error) {
      console.error(
        "Failed to create Truvern routing notifications",
        error,
      );
    }
  }

  return json(200, {
    ok: true,
    assignmentId:
      result.assignmentId,
    action: result.action,
    ...(result.reviewerUserId
      ? {
          reviewerUserId:
            result.reviewerUserId,
        }
      : {}),
    ...(result.reviewerName
      ? {
          reviewerName:
            result.reviewerName,
        }
      : {}),
    ...(result.reservation !==
    undefined
      ? {
          reservation:
            result.reservation,
        }
      : {}),
    ...(result.creditReversal !==
    undefined
      ? {
          creditReversal:
            result.creditReversal,
        }
      : {}),
  });
}
