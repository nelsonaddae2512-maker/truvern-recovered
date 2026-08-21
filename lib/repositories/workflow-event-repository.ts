import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type WorkflowEventClient = Pick<
  Prisma.TransactionClient,
  "workflowEvent"
>;

export async function createWorkflowEvent<
  T extends Prisma.WorkflowEventCreateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.WorkflowEventCreateArgs
  >,
  client: WorkflowEventClient = prisma,
): Promise<
  Prisma.WorkflowEventGetPayload<T>
> {
  return client.workflowEvent.create(args);
}