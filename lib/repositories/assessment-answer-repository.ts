import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type AssessmentAnswerClient = Pick<
  Prisma.TransactionClient,
  "assessmentAnswer"
>;

export async function findAssessmentAnswers<
  T extends Prisma.AssessmentAnswerFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.AssessmentAnswerFindManyArgs
  >,
  client: AssessmentAnswerClient = prisma,
): Promise<
  Prisma.AssessmentAnswerGetPayload<T>[]
> {
  return client.assessmentAnswer.findMany(args);
}
