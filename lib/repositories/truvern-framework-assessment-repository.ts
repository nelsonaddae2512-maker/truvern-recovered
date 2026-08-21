import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type TruvernFrameworkAssessmentClient = Pick<
  Prisma.TransactionClient,
  "truvernFrameworkAssessment"
>;

export async function findTruvernFrameworkAssessments<
  T extends Prisma.TruvernFrameworkAssessmentFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernFrameworkAssessmentFindManyArgs
  >,
  client: TruvernFrameworkAssessmentClient = prisma,
): Promise<
  Prisma.TruvernFrameworkAssessmentGetPayload<T>[]
> {
  return client.truvernFrameworkAssessment.findMany(args);
}

export async function findTruvernFrameworkAssessment<
  T extends Prisma.TruvernFrameworkAssessmentFindUniqueArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernFrameworkAssessmentFindUniqueArgs
  >,
  client: TruvernFrameworkAssessmentClient = prisma,
): Promise<
  Prisma.TruvernFrameworkAssessmentGetPayload<T> | null
> {
  return client.truvernFrameworkAssessment.findUnique(args);
}

export async function updateTruvernFrameworkAssessment<
  T extends Prisma.TruvernFrameworkAssessmentUpdateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernFrameworkAssessmentUpdateArgs
  >,
  client: TruvernFrameworkAssessmentClient = prisma,
): Promise<
  Prisma.TruvernFrameworkAssessmentGetPayload<T>
> {
  return client.truvernFrameworkAssessment.update(args);
}

export async function createTruvernFrameworkAssessment<
  T extends Prisma.TruvernFrameworkAssessmentCreateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernFrameworkAssessmentCreateArgs
  >,
  client: TruvernFrameworkAssessmentClient = prisma,
): Promise<
  Prisma.TruvernFrameworkAssessmentGetPayload<T>
> {
  return client.truvernFrameworkAssessment.create(args);
}

export async function requireTruvernFrameworkAssessment<
  T extends Prisma.TruvernFrameworkAssessmentFindUniqueOrThrowArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernFrameworkAssessmentFindUniqueOrThrowArgs
  >,
  client: TruvernFrameworkAssessmentClient = prisma,
): Promise<
  Prisma.TruvernFrameworkAssessmentGetPayload<T>
> {
  return client.truvernFrameworkAssessment.findUniqueOrThrow(args);
}
