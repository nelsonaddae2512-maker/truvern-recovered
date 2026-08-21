import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type AssessmentRunClient = Pick<
  Prisma.TransactionClient,
  "assessmentRun"
>;

export async function findFirstAssessmentRun<
  T extends Prisma.AssessmentRunFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.AssessmentRunFindFirstArgs
  >,
  client: AssessmentRunClient = prisma,
): Promise<
  Prisma.AssessmentRunGetPayload<T> | null
> {
  return client.assessmentRun.findFirst(args);
}

export async function updateManyAssessmentRuns(
  args: Prisma.AssessmentRunUpdateManyArgs,
  client: AssessmentRunClient = prisma,
) {
  return client.assessmentRun.updateMany(args);
}
