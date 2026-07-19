import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

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
      return NextResponse.json({ ok: false, error: "Queue item id required." }, { status: 400 });
    }

    const reviewerId = String(body?.reviewerId || "TRUVERN_REVIEWER");
    const reviewerName = String(body?.reviewerName || "Truvern Reviewer");

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      update "WorkflowQueueItem"
      set
        "assignedTo" = $1,
        payload = coalesce(payload, '{}'::jsonb) || $2::jsonb,
        "updatedAt" = now()
      where id = $3
        and status = 'OPEN'
      returning *
      `,
      reviewerId,
      JSON.stringify({
        assignedReviewerName: reviewerName,
        claimedAt: new Date().toISOString(),
      }),
      queueItemId,
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Queue item not available." }, { status: 409 });
    }

    await prisma.$executeRawUnsafe(
      `
      insert into "WorkflowEvent" (
        "workflowId",
        "organizationId",
        "vendorId",
        "reviewAssignmentId",
        type,
        actor,
        summary,
        payload,
        "createdAt"
      )
      values ($1, $2, $3, $4, 'QUEUE_ITEM_CLAIMED', $5, $6, $7::jsonb, now())
      `,
      rows[0].workflowId,
      rows[0].organizationId,
      rows[0].vendorId,
      rows[0].reviewAssignmentId,
      reviewerId,
      `${reviewerName} claimed workflow queue item.`,
      JSON.stringify({ queueItemId }),
    );

    return NextResponse.json({ ok: true, item: rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to claim queue item.") },
      { status: 500 },
    );
  }
}

