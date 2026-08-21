import prisma from "@/lib/prisma";

export type TransparencyLedgerCountRow = {
  count: number;
};

export type TransparencyCheckpointStateRow = {
  entryCount: number;
  generatedAt: Date;
};

export async function readTransparencyLedgerCount(): Promise<
  TransparencyLedgerCountRow[]
> {
  return prisma.$queryRaw<TransparencyLedgerCountRow[]>`
    select count(*)::int as count
    from "GovernanceTransparencyLog"
  `;
}

export async function readLatestTransparencyCheckpoint(): Promise<
  TransparencyCheckpointStateRow[]
> {
  return prisma.$queryRaw<TransparencyCheckpointStateRow[]>`
    select
      "entryCount",
      "generatedAt"
    from "GovernanceTransparencyCheckpoint"
    order by "generatedAt" desc, id desc
    limit 1
  `;
}