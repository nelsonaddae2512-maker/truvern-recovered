import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { findFirstWorkflowQueueItem, findWorkflowQueueItem, updateWorkflowQueueItems } from "@/lib/repositories/workflow-queue-repository";
import { createWorkflowEvent } from "@/lib/repositories/workflow-event-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function queueScopeForActor(
  actor: Awaited<ReturnType<typeof requireReviewerAccess>>,
): Promise<Prisma.WorkflowQueueItemWhereInput> {
  if (actor.role === "OPS") {
    return {};
  }

  if (actor.role === "TRUVERN_REVIEWER") {
    const assignments = await prisma.reviewAssignment.findMany({
      where: {
        assignmentType: "TRUVERN",
        reviewerUserId: actor.userId,
      },
      select: {
        id: true,
      },
    });

    return {
      reviewAssignmentId: {
        in: assignments.map((assignment) => assignment.id),
      },
    };
  }

  if (actor.organizationId == null) {
    return {
      id: -1,
    };
  }

  return {
    organizationId: actor.organizationId,
  };
}

function reviewerDisplayName(
  user: Awaited<ReturnType<typeof currentUser>>,
) {
  const fullName = user?.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  const combined =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

  if (combined) {
    return combined;
  }

  return (
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    "Internal reviewer"
  );
}

export async function POST(_request: Request) {
  try {
    const actor = await requireReviewerAccess();
    const scope = await queueScopeForActor(actor);
    const clerkUser = await currentUser();
    const reviewerId = actor.userId;
    const reviewerName = reviewerDisplayName(clerkUser);

    let claimedItem: any = null;

    for (let attempt = 0; attempt < 5 && !claimedItem; attempt += 1) {
      try {
        claimedItem = await prisma.$transaction(
          async (tx) => {
            const candidate = await findFirstWorkflowQueueItem({
              where: {
                AND: [
                  scope,
                  {
                    status: "OPEN",
                    assignedTo: null,
                  },
                ],
              },
              orderBy: [
                { priority: "desc" },
                {
                  dueAt: {
                    sort: "asc",
                    nulls: "last",
                  },
                },
                { updatedAt: "asc" },
              ],
            }, tx);

            if (!candidate) {
              return null;
            }

            const claimedAt = new Date().toISOString();

            const updateResult =
              await updateWorkflowQueueItems({
                where: {
                  AND: [
                    scope,
                    {
                      id: candidate.id,
                      status: "OPEN",
                      assignedTo: null,
                    },
                  ],
                },
                data: {
                  assignedTo: reviewerId,
                  payload: {
                    ...(candidate.payload &&
                    typeof candidate.payload === "object" &&
                    !Array.isArray(candidate.payload)
                      ? (candidate.payload as Record<string, any>)
                      : {}),
                    assignedReviewerName: reviewerName,
                    claimedAt,
                    claimMode: "CLAIM_NEXT",
                  },
                },
              }, tx);

            if (updateResult.count !== 1) {
              throw new Error("QUEUE_CLAIM_RACE");
            }

            const item = await findWorkflowQueueItem({
              where: {
                id: candidate.id,
              },
            }, tx);

            if (!item) {
              throw new Error("QUEUE_CLAIM_RACE");
            }

            await createWorkflowEvent({
              data: {
                workflowId: item.workflowId,
                organizationId: item.organizationId,
                vendorId: item.vendorId,
                reviewAssignmentId: item.reviewAssignmentId,
                type: "QUEUE_ITEM_CLAIMED",
                actor: reviewerId,
                summary:
                  `${reviewerName} claimed next highest-priority workflow item.`,
                payload: {
                  queueItemId: item.id,
                  claimMode: "CLAIM_NEXT",
                },
              },
            }, tx);

            return item;
          },
          {
            isolationLevel: "Serializable",
          },
        );
      } catch (error: any) {
        const retryable =
          error?.code === "P2034" ||
          error?.message === "QUEUE_CLAIM_RACE";

        if (!retryable || attempt === 4) {
          throw error;
        }
      }
    }

    if (!claimedItem) {
      return NextResponse.json(
        { ok: false, error: "No unclaimed work available." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      item: claimedItem,
    });
  } catch (error: any) {
    const governanceResponse =
      governanceAuthErrorResponse(error);

    if (governanceResponse) {
      return governanceResponse;
    }

    return NextResponse.json(
      {
        ok: false,
        error: String(
          error?.message || "Failed to claim next work item.",
        ),
      },
      { status: 500 },
    );
  }
}