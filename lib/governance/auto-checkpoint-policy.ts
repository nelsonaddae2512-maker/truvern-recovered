import prisma from "@/lib/prisma";
import { persistTransparencyChainCheckpoint } from "@/lib/governance/persist-chain-checkpoint";

function safeInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export async function maybePersistTransparencyCheckpoint(input?: {
  force?: boolean;
  entryThreshold?: number;
}) {
  const force = !!input?.force;
  const entryThreshold = input?.entryThreshold || 25;

  const ledgerRows: any[] = await prisma.$queryRawUnsafe(`
    select count(*)::int as count
    from "GovernanceTransparencyLog"
  `);

  const checkpointRows: any[] = await prisma.$queryRawUnsafe(`
    select
      "entryCount",
      "generatedAt"
    from "GovernanceTransparencyCheckpoint"
    order by "generatedAt" desc, id desc
    limit 1
  `);

  const ledgerCount = safeInt(ledgerRows?.[0]?.count);
  const latestCheckpointEntryCount =
    safeInt(checkpointRows?.[0]?.entryCount);

  const entriesSinceLastCheckpoint =
    ledgerCount - latestCheckpointEntryCount;

  const shouldCheckpoint =
    force ||
    !checkpointRows.length ||
    entriesSinceLastCheckpoint >= entryThreshold;

  if (!shouldCheckpoint) {
    return {
      ok: true,
      checkpointCreated: false,
      ledgerCount,
      latestCheckpointEntryCount,
      entriesSinceLastCheckpoint,
      threshold: entryThreshold,
    };
  }

  const checkpoint = await persistTransparencyChainCheckpoint();

  return {
    ok: true,
    checkpointCreated: true,
    ledgerCount,
    latestCheckpointEntryCount,
    entriesSinceLastCheckpoint,
    threshold: entryThreshold,
    checkpoint,
  };
}
