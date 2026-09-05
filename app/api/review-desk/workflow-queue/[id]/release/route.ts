import { NextResponse } from "next/server";
import {
  requireGovernanceCapability,
  requireReviewerAccess
} from "@/lib/auth/truvern-governance";
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
    const reviewer = await requireReviewerAccess();
    requireGovernanceCapability(
      reviewer,
      "assessment.review",
    );

    const resolved = await props.params;
    const queueItemId = Number(resolved.id);

    if (!Number.isFinite(queueItemId) || queueItemId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Queue item id required." },
        { status: 400 },
      );
    }

    const auditActor = reviewer.role;

    const result = await prisma.$transaction(async (tx) => {
      const current = await findWorkflowQueueItem({
        where: { id: queueItemId },
      }, tx);

      if (!current || current.status !== "OPEN") {
        return null;
      }

      if (
        reviewer.role !== "OPS" &&
        reviewer.role !== "TRUVERN_REVIEWER" &&
        (
          reviewer.organizationId == null ||
          reviewer.organizationId !== current.organizationId
        )
      ) {
        return {
          kind: "FORBIDDEN" as const,
          item: null,
        };
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
          actor: auditActor,
          summary: "Workflow queue item released.",
          payload: {
            queueItemId,
          },
        },
      }, tx);

      return {
        kind: "RELEASED" as const,
        item,
      };
    });

    if (result?.kind === "FORBIDDEN") {
      return NextResponse.json(
        {
          ok: false,
          error: "Reviewer does not have access to this workflow queue item.",
        },
        { status: 403 },
      );
    }

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Queue item not available." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      item: result.item,
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
