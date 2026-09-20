import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  requireReviewAssignmentAccess,
  requireReviewerAccess,
} from "@/lib/auth/truvern-governance";
import {
  governanceAuthErrorResponse,
  governanceForbidden,
} from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import {
  findWorkflowQueueItem,
  updateWorkflowQueueItems,
} from "@/lib/repositories/workflow-queue-repository";
import { createWorkflowEvent } from "@/lib/repositories/workflow-event-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function jsonObject(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function trustedReviewerName() {
  const user = await currentUser();

  if (!user) {
    return "Internal reviewer";
  }

  const displayName =
    user.fullName?.trim() ||
    [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    user.primaryEmailAddress?.emailAddress?.trim() ||
    "Internal reviewer";

  return displayName;
}

export async function POST(
  _request: Request,
  props: Props,
) {
  try {
    const actor =
      await requireReviewerAccess();

    const resolved =
      await props.params;

    const queueItemId =
      Number(resolved.id);

    if (
      !Number.isInteger(queueItemId) ||
      queueItemId <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Queue item id required.",
        },
        {
          status: 400,
        },
      );
    }

    const current =
      await findWorkflowQueueItem({
        where: {
          id: queueItemId,
        },
      });

    if (
      !current ||
      current.status !== "OPEN"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Queue item not available.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      current.reviewAssignmentId != null
    ) {
      await requireReviewAssignmentAccess(
        current.reviewAssignmentId,
      );
    } else if (actor.role !== "OPS") {
      if (
        actor.role ===
          "TRUVERN_REVIEWER" ||
        actor.organizationId == null ||
        actor.organizationId !==
          current.organizationId
      ) {
        throw governanceForbidden(
          "Workflow queue item access denied.",
        );
      }
    }

    const reviewerId =
      actor.userId;

    const reviewerName =
      await trustedReviewerName();

    const result =
      await prisma.$transaction(
        async (tx) => {
          const authorizedCurrent =
            await findWorkflowQueueItem(
              {
                where: {
                  id: queueItemId,
                },
              },
              tx,
            );

          if (
            !authorizedCurrent ||
            authorizedCurrent.status !==
              "OPEN" ||
            authorizedCurrent.organizationId !==
              current.organizationId ||
            authorizedCurrent.reviewAssignmentId !==
              current.reviewAssignmentId
          ) {
            return null;
          }

          const claimedAt =
            new Date().toISOString();

          const updateResult =
            await updateWorkflowQueueItems(
              {
                where: {
                  id: queueItemId,
                  status: "OPEN",
                  organizationId:
                    current.organizationId,
                  reviewAssignmentId:
                    current.reviewAssignmentId ==
                    null
                      ? null
                      : current.reviewAssignmentId,
                },
                data: {
                  assignedTo:
                    reviewerId,
                  payload: {
                    ...jsonObject(
                      authorizedCurrent.payload,
                    ),
                    assignedReviewerName:
                      reviewerName,
                    claimedAt,
                  },
                },
              },
              tx,
            );

          if (
            updateResult.count !== 1
          ) {
            return null;
          }

          const item =
            await findWorkflowQueueItem(
              {
                where: {
                  id: queueItemId,
                },
              },
              tx,
            );

          if (!item) {
            return null;
          }

          await createWorkflowEvent(
            {
              data: {
                workflowId:
                  item.workflowId,
                organizationId:
                  item.organizationId,
                vendorId:
                  item.vendorId,
                reviewAssignmentId:
                  item.reviewAssignmentId,
                type:
                  "QUEUE_ITEM_CLAIMED",
                actor:
                  reviewerId,
                summary:
                  `${reviewerName} claimed workflow queue item.`,
                payload: {
                  queueItemId,
                },
              },
            },
            tx,
          );

          return item;
        },
      );

    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          error: "Queue item not available.",
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      item: result,
    });
  } catch (error: unknown) {
    const authResponse =
      governanceAuthErrorResponse(
        error,
      );

    if (authResponse) {
      return authResponse;
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to claim queue item.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}