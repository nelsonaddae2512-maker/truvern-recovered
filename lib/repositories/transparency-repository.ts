import prisma from "@/lib/prisma";

export type TransparencyEntryRow = Record<string, any>;

export type TransparencyCheckpointRow = {
  entryHash: string | null;
};

export async function readTransparencyEntries(): Promise<
  TransparencyEntryRow[]
> {
  return prisma.$queryRaw<TransparencyEntryRow[]>`
    select *
    from "GovernanceTransparencyLog"
    order by timestamp desc, id desc
    limit 100
  `;
}

export async function readTransparencyCheckpointHashes(): Promise<
  TransparencyCheckpointRow[]
> {
  return prisma.$queryRaw<TransparencyCheckpointRow[]>`
    select
      "entryHash"
    from "GovernanceTransparencyLog"
    order by timestamp asc, id asc
  `;
}