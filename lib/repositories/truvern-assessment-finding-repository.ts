import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type TruvernAssessmentFindingClient = Pick<
  Prisma.TransactionClient,
  "truvernAssessmentFinding"
>;

export async function findTruvernAssessmentFindings<
  T extends Prisma.TruvernAssessmentFindingFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernAssessmentFindingFindManyArgs
  >,
  client: TruvernAssessmentFindingClient = prisma,
): Promise<
  Prisma.TruvernAssessmentFindingGetPayload<T>[]
> {
  return client.truvernAssessmentFinding.findMany(args);
}

export async function countTruvernAssessmentFindings(
  args: Prisma.TruvernAssessmentFindingCountArgs,
  client: TruvernAssessmentFindingClient = prisma,
) {
  return client.truvernAssessmentFinding.count(args);
}

export async function updateTruvernAssessmentFinding<
  T extends Prisma.TruvernAssessmentFindingUpdateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernAssessmentFindingUpdateArgs
  >,
  client: TruvernAssessmentFindingClient = prisma,
): Promise<
  Prisma.TruvernAssessmentFindingGetPayload<T>
> {
  return client.truvernAssessmentFinding.update(args);
}

export async function deleteTruvernAssessmentFindings(
  args: Prisma.TruvernAssessmentFindingDeleteManyArgs,
  client: TruvernAssessmentFindingClient = prisma,
) {
  return client.truvernAssessmentFinding.deleteMany(args);
}

export async function createTruvernAssessmentFindings(
  args: Prisma.TruvernAssessmentFindingCreateManyArgs,
  client: TruvernAssessmentFindingClient = prisma,
) {
  return client.truvernAssessmentFinding.createMany(args);
}
