import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type TruvernAssessmentResponseClient = Pick<
  Prisma.TransactionClient,
  "truvernAssessmentResponse"
>;

export async function createTruvernAssessmentResponses(
  args: Prisma.TruvernAssessmentResponseCreateManyArgs,
  client: TruvernAssessmentResponseClient = prisma,
) {
  return client.truvernAssessmentResponse.createMany(args);
}

export async function findFirstTruvernAssessmentResponse<
  T extends Prisma.TruvernAssessmentResponseFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernAssessmentResponseFindFirstArgs
  >,
  client: TruvernAssessmentResponseClient = prisma,
): Promise<
  Prisma.TruvernAssessmentResponseGetPayload<T> | null
> {
  return client.truvernAssessmentResponse.findFirst(args);
}

export async function updateTruvernAssessmentResponse<
  T extends Prisma.TruvernAssessmentResponseUpdateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernAssessmentResponseUpdateArgs
  >,
  client: TruvernAssessmentResponseClient = prisma,
): Promise<
  Prisma.TruvernAssessmentResponseGetPayload<T>
> {
  return client.truvernAssessmentResponse.update(args);
}
