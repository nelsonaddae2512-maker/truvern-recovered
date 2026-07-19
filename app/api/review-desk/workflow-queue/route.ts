import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await requireReviewerAccess();
    const summary = await prisma.$queryRawUnsafe(`
      select
        queue,
        status,
        count(*)::int as count,
        max("updatedAt") as "lastUpdatedAt"
      from "WorkflowQueueItem"
      group by queue, status
      order by queue asc, status asc
    `);

    const items = await prisma.$queryRawUnsafe(`
      select
        qi.id,
        qi.queue,
        qi.status,
        qi.priority,
        qi."dueAt",
        qi."updatedAt",
        qi.payload,
        wi.id as "workflowId",
        wi."currentStage",
        wi.type as "workflowType",
        rp.id as "packageId",
        rp.title as "packageTitle",
        rp.status as "packageStatus",
        rp.severity,
        v.name as "vendorName",
        o.name as "organizationName",
        qi."reviewAssignmentId"
      from "WorkflowQueueItem" qi
      left join "WorkflowInstance" wi
        on wi.id = qi."workflowId"
      left join "RemediationPackage" rp
        on qi.payload->>'remediationPackageId' = rp.id::text
      left join "Vendor" v
        on v.id = qi."vendorId"
      left join "Organization" o
        on o.id = qi."organizationId"
      where qi.status = 'OPEN'
      order by qi.priority desc, qi."dueAt" asc nulls last, qi."updatedAt" asc
      limit 100
    `);

    return NextResponse.json({ ok: true, summary, items });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to load workflow queue.") },
      { status: 500 },
    );
  }
}

