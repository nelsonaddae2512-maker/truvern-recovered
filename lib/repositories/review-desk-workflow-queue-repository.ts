import prisma from "@/lib/prisma";

export type WorkflowQueueSummaryRow = {
  queue: string;
  status: string;
  count: number;
};

export type WorkflowQueueRow = {
  id: number;
  queue: string;
  status: string;
  priority: number;
  dueAt: Date | null;
  updatedAt: Date;
  assignedTo: string | null;
  payload: any;
  packageId: number | null;
  packageTitle: string | null;
  packageStatus: string | null;
  severity: string | null;
  vendorName: string | null;
  organizationName: string | null;
  reviewAssignmentId: number | null;
};

export async function readWorkflowQueueSummary(): Promise<
  WorkflowQueueSummaryRow[]
> {
  return prisma.$queryRaw<WorkflowQueueSummaryRow[]>`
    select
      queue,
      status,
      count(*)::int as count
    from "WorkflowQueueItem"
    group by queue, status
    order by queue asc, status asc
  `;
}

export async function readOpenWorkflowQueueItems(): Promise<
  WorkflowQueueRow[]
> {
  return prisma.$queryRaw<WorkflowQueueRow[]>`
    select
      qi.id,
      qi.queue,
      qi.status,
      qi.priority,
      qi."dueAt",
      qi."updatedAt",
      qi."assignedTo",
      qi.payload,
      rp.id as "packageId",
      rp.title as "packageTitle",
      rp.status as "packageStatus",
      rp.severity,
      v.name as "vendorName",
      o.name as "organizationName",
      qi."reviewAssignmentId"
    from "WorkflowQueueItem" qi
    left join "RemediationPackage" rp
      on qi.payload->>'remediationPackageId' = rp.id::text
    left join "Vendor" v
      on v.id = qi."vendorId"
    left join "Organization" o
      on o.id = qi."organizationId"
    where qi.status = 'OPEN'
    order by
      qi.priority desc,
      qi."dueAt" asc nulls last,
      qi."updatedAt" asc
    limit 100
  `;
}