import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type TruvernAssessmentAttestationClient = Pick<
  Prisma.TransactionClient,
  "truvernAssessmentAttestation"
>;

export async function findFirstTruvernAssessmentAttestation<
  T extends Prisma.TruvernAssessmentAttestationFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernAssessmentAttestationFindFirstArgs
  >,
  client: TruvernAssessmentAttestationClient = prisma,
): Promise<
  Prisma.TruvernAssessmentAttestationGetPayload<T> | null
> {
  return client.truvernAssessmentAttestation.findFirst(args);
}

export async function countTruvernAssessmentAttestations(
  args: Prisma.TruvernAssessmentAttestationCountArgs,
  client: TruvernAssessmentAttestationClient = prisma,
) {
  return client.truvernAssessmentAttestation.count(args);
}

export async function updateTruvernAssessmentAttestation<
  T extends Prisma.TruvernAssessmentAttestationUpdateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernAssessmentAttestationUpdateArgs
  >,
  client: TruvernAssessmentAttestationClient = prisma,
): Promise<
  Prisma.TruvernAssessmentAttestationGetPayload<T>
> {
  return client.truvernAssessmentAttestation.update(args);
}

export async function createTruvernAssessmentAttestation<
  T extends Prisma.TruvernAssessmentAttestationCreateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.TruvernAssessmentAttestationCreateArgs
  >,
  client: TruvernAssessmentAttestationClient = prisma,
): Promise<
  Prisma.TruvernAssessmentAttestationGetPayload<T>
> {
  return client.truvernAssessmentAttestation.create(args);
}
