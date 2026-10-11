import prisma from "@/lib/prisma";

export type R17CanaryDatabaseIdentityRow = {
  databaseName: string;
  schemaName: string;
};

export async function readR17CanaryDatabaseIdentity(): Promise<
  R17CanaryDatabaseIdentityRow[]
> {
  return prisma.$queryRaw<R17CanaryDatabaseIdentityRow[]>`
    select
      current_database() as "databaseName",
      current_schema() as "schemaName"
  `;
}