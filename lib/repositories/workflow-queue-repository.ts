import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type WorkflowQueueClient = Pick<
  Prisma.TransactionClient,
  "workflowQueueItem"
>;

export async function findWorkflowQueueItem<
  T extends Prisma.WorkflowQueueItemFindUniqueArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.WorkflowQueueItemFindUniqueArgs
  >,
  client: WorkflowQueueClient = prisma,
): Promise<
  Prisma.WorkflowQueueItemGetPayload<T> | null
> {
  return client.workflowQueueItem.findUnique(args);
}

export async function findFirstWorkflowQueueItem<
  T extends Prisma.WorkflowQueueItemFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.WorkflowQueueItemFindFirstArgs
  >,
  client: WorkflowQueueClient = prisma,
): Promise<
  Prisma.WorkflowQueueItemGetPayload<T> | null
> {
  return client.workflowQueueItem.findFirst(args);
}
export async function updateWorkflowQueueItems(
  args: Prisma.WorkflowQueueItemUpdateManyArgs,
  client: WorkflowQueueClient = prisma,
) {
  return client.workflowQueueItem.updateMany(args);
}
export async function findWorkflowQueueItems<
  T extends Prisma.WorkflowQueueItemFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.WorkflowQueueItemFindManyArgs
  >,
  client: WorkflowQueueClient = prisma,
): Promise<
  Prisma.WorkflowQueueItemGetPayload<T>[]
> {
  return client.workflowQueueItem.findMany(args);
}
export async function groupWorkflowQueueItems(
  client: WorkflowQueueClient = prisma,
) {
  return client.workflowQueueItem.groupBy({
    by: ["queue", "status"],
    _count: {
      _all: true,
    },
    _max: {
      updatedAt: true,
    },
    orderBy: [
      { queue: "asc" },
      { status: "asc" },
    ],
  });
}
export type WorkflowQueueWriteRow = {
  id: number;
};

export async function updateWorkflowQueueItemForPackage(input: {
  queue: string;
  status: string;
  priority: number;
  workflowId: number;
  dueAt?: Date | string | null;
  payloadJson: string;
  packageId: number;
}): Promise<WorkflowQueueWriteRow[]> {
  return prisma.$queryRaw<WorkflowQueueWriteRow[]>`
    update "WorkflowQueueItem"
    set
      queue = ${input.queue},
      status = ${input.status},
      priority = ${input.priority},
      "workflowId" = ${input.workflowId},
      "dueAt" = ${input.dueAt ?? null},
      payload =
        coalesce(payload, '{}'::jsonb)
        || ${input.payloadJson}::jsonb,
      "updatedAt" = now()
    where payload->>'remediationPackageId' = ${String(input.packageId)}
    returning id
  `;
}

export async function insertWorkflowQueueItem(input: {
  workflowId: number;
  organizationId: number;
  vendorId?: number | null;
  reviewAssignmentId?: number | null;
  queue: string;
  status: string;
  priority: number;
  dueAt?: Date | string | null;
  payloadJson: string;
}): Promise<WorkflowQueueWriteRow[]> {
  return prisma.$queryRaw<WorkflowQueueWriteRow[]>`
    insert into "WorkflowQueueItem" (
      "workflowId",
      "organizationId",
      "vendorId",
      "reviewAssignmentId",
      queue,
      status,
      priority,
      "dueAt",
      payload,
      "createdAt",
      "updatedAt"
    )
    values (
      ${input.workflowId},
      ${input.organizationId},
      ${input.vendorId ?? null},
      ${input.reviewAssignmentId ?? null},
      ${input.queue},
      ${input.status},
      ${input.priority},
      ${input.dueAt ?? null},
      ${input.payloadJson}::jsonb,
      now(),
      now()
    )
    returning id
  `;
}