import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type RemediationPackageClient = Pick<
  Prisma.TransactionClient,
  "remediationPackage"
>;

export async function updateRemediationPackage<
  T extends Prisma.RemediationPackageUpdateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.RemediationPackageUpdateArgs
  >,
  client: RemediationPackageClient = prisma,
): Promise<
  Prisma.RemediationPackageGetPayload<T>
> {
  return client.remediationPackage.update(args);
}

export async function findRemediationPackages<
  T extends Prisma.RemediationPackageFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.RemediationPackageFindManyArgs
  >,
  client: RemediationPackageClient = prisma,
): Promise<
  Prisma.RemediationPackageGetPayload<T>[]
> {
  return client.remediationPackage.findMany(args);
}
export async function upsertRemediationPackage<
  T extends Prisma.RemediationPackageUpsertArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.RemediationPackageUpsertArgs
  >,
  client: RemediationPackageClient = prisma,
): Promise<
  Prisma.RemediationPackageGetPayload<T>
> {
  return client.remediationPackage.upsert(args);
}