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

    const actor = String(body?.actor || "TRUVERN_REVIEWER");

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      update "WorkflowQueueItem"
      set
        "assignedTo" = null,
        payload = coalesce(payload, '{}'::jsonb) || $1::jsonb,
        "updatedAt" = now()
      where id = $2
        and status = 'OPEN'
      returning *
      `,
      JSON.stringify({
        releasedAt: new Date().toISOString(),
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
      values ($1, $2, $3, $4, 'QUEUE_ITEM_RELEASED', $5, 'Workflow queue item released.', $6::jsonb, now())
      `,
      rows[0].workflowId,
      rows[0].organizationId,
      rows[0].vendorId,
      rows[0].reviewAssignmentId,
      actor,
      JSON.stringify({ queueItemId }),
    );

    return NextResponse.json({ ok: true, item: rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to release queue item.") },
      { status: 500 },
    );
  }
}

