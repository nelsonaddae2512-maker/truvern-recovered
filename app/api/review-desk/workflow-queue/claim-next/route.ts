import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";
import { findFirstWorkflowQueueItem, findWorkflowQueueItem, updateWorkflowQueueItems } from "@/lib/repositories/workflow-queue-repository";
import { createWorkflowEvent } from "@/lib/repositories/workflow-event-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    await requireReviewerAccess();

    const body = await request.json().catch(() => ({}));

    const reviewerId = String(body?.reviewerId || "TRUVERN_REVIEWER");
    const reviewerName = String(
      body?.reviewerName || "Truvern Reviewer",
    );

    let claimedItem: any = null;

    for (let attempt = 0; attempt < 5 && !claimedItem; attempt += 1) {
      try {
        claimedItem = await prisma.$transaction(
          async (tx) => {
            const candidate = await findFirstWorkflowQueueItem({
              where: {
                status: "OPEN",
                assignedTo: null,
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
                  id: candidate.id,
                  status: "OPEN",
                  assignedTo: null,
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
