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

    const actor = String(body?.actor || "TRUVERN_REVIEWER");

    const result = await prisma.$transaction(async (tx) => {
      const current = await findWorkflowQueueItem({
        where: { id: queueItemId },
      }, tx);

      if (!current || current.status !== "OPEN") {
        return null;
      }

      const updateResult = await updateWorkflowQueueItems({
        where: {
          id: queueItemId,
          status: "OPEN",
        },
        data: {
          assignedTo: null,
          payload: {
            ...(current.payload &&
            typeof current.payload === "object" &&
            !Array.isArray(current.payload)
              ? (current.payload as Record<string, any>)
              : {}),
            releasedAt: new Date().toISOString(),
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
          type: "QUEUE_ITEM_RELEASED",
          actor,
          summary: "Workflow queue item released.",
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
        error: String(error?.message || "Failed to release queue item."),
      },
      { status: 500 },
    );
  }
}
