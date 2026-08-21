import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";
import { findWorkflowQueueItem, updateWorkflowQueueItems } from "@/lib/repositories/workflow-queue-repository";
import { createWorkflowEvent } from "@/lib/repositories/workflow-event-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function jsonObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export async function POST(request: Request, props: Props) {
  try {
    await requireReviewerAccess();

    const resolved = await props.params;
    const queueItemId = Number(resolved.id);
    const body = await request.json().catch(() => ({}));

    if (!Number.isFinite(queueItemId) || queueItemId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Queue item id required." },
        { status: 400 },
      );
    }

    const reviewerId = String(body?.reviewerId || "TRUVERN_REVIEWER");
    const reviewerName = String(
      body?.reviewerName || "Truvern Reviewer",
    );

    const result = await prisma.$transaction(async (tx) => {
      const current = await findWorkflowQueueItem({
        where: { id: queueItemId },
      }, tx);

      if (!current || current.status !== "OPEN") {
        return null;
      }

      const claimedAt = new Date().toISOString();

      const updateResult = await updateWorkflowQueueItems({
        where: {
          id: queueItemId,
          status: "OPEN",
        },
        data: {
          assignedTo: reviewerId,
          payload: {
            ...jsonObject(current.payload),
            assignedReviewerName: reviewerName,
            claimedAt,
          },
        },
      }, tx);

      if (updateResult.count !== 1) {
        return null;
      }

      const item = await findWorkflowQueueItem({
        where: { id: queueItemId },
      }, tx);

      if (!item) {
        return null;
      }

      await createWorkflowEvent({
        data: {
          workflowId: item.workflowId,
          organizationId: item.organizationId,
          vendorId: item.vendorId,
          reviewAssignmentId: item.reviewAssignmentId,
          type: "QUEUE_ITEM_CLAIMED",
          actor: reviewerId,
          summary: `${reviewerName} claimed workflow queue item.`,
          payload: {
            queueItemId,
          },
        },
      }, tx);

      return item;
    });

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Queue item not available." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      item: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(error?.message || "Failed to claim queue item."),
      },
      { status: 500 },
    );
  }
}
