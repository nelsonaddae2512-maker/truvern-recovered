import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type AssessmentClient = Pick<
  Prisma.TransactionClient,
  "assessment"
>;

export async function createAssessment<
  T extends Prisma.AssessmentCreateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.AssessmentCreateArgs
  >,
  client: AssessmentClient = prisma,
): Promise<Prisma.AssessmentGetPayload<T>> {
  return client.assessment.create(args);
}

export async function findFirstAssessment<
  T extends Prisma.AssessmentFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.AssessmentFindFirstArgs
  >,
  client: AssessmentClient = prisma,
): Promise<
  Prisma.AssessmentGetPayload<T> | null
> {
  return client.assessment.findFirst(args);
}

export async function updateAssessment<
  T extends Prisma.AssessmentUpdateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.AssessmentUpdateArgs
  >,
  client: AssessmentClient = prisma,
): Promise<
  Prisma.AssessmentGetPayload<T>
> {
  return client.assessment.update(args);
}

export async function updateManyAssessment(
  args: Prisma.AssessmentUpdateManyArgs,
  client: AssessmentClient = prisma,
): Promise<Prisma.BatchPayload> {
  return client.assessment.updateMany(args);
}
export async function findAssessment<
  T extends Prisma.AssessmentFindUniqueArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.AssessmentFindUniqueArgs
  >,
  client: AssessmentClient = prisma,
): Promise<
  Prisma.AssessmentGetPayload<T> | null
> {
  return client.assessment.findUnique(args);
}
