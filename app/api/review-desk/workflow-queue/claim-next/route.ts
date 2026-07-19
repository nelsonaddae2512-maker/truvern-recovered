import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    await requireReviewerAccess();
    const body = await request.json().catch(() => ({}));
    const reviewerId = String(body?.reviewerId || "TRUVERN_REVIEWER");
    const reviewerName = String(body?.reviewerName || "Truvern Reviewer");

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      with next_item as (
        select id
        from "WorkflowQueueItem"
        where status = 'OPEN'
          and "assignedTo" is null
        order by priority desc, "dueAt" asc nulls last, "updatedAt" asc
        limit 1
        for update skip locked
      )
      update "WorkflowQueueItem" qi
      set
        "assignedTo" = $1,
        payload = coalesce(qi.payload, '{}'::jsonb) || $2::jsonb,
        "updatedAt" = now()
      from next_item
      where qi.id = next_item.id
      returning qi.*
      `,
      reviewerId,
      JSON.stringify({
        assignedReviewerName: reviewerName,
        claimedAt: new Date().toISOString(),
        claimMode: "CLAIM_NEXT",
      }),
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "No unclaimed work available." }, { status: 404 });
    }

    const item = rows[0];

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
      item.workflowId,
      item.organizationId,
      item.vendorId,
      item.reviewAssignmentId,
      reviewerId,
      `${reviewerName} claimed next highest-priority workflow item.`,
      JSON.stringify({ queueItemId: item.id, claimMode: "CLAIM_NEXT" }),
    );

    return NextResponse.json({ ok: true, item });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to claim next work item.") },
      { status: 500 },
    );
  }
}

