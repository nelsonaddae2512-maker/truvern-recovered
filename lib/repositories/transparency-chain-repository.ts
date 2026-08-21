import prisma from "@/lib/prisma";

export type TransparencyChainEntryRow = {
  id: number;
  receiptId: string | null;
  assignmentId: number | null;
  responseId: number | null;
  checksum: string | null;
  entryHash: string | null;
  previousEntryHash: string | null;
  timestamp: Date | null;
  createdAt: Date;
};

export async function readTransparencyChainEntries(
  limit = 100,
): Promise<TransparencyChainEntryRow[]> {
  return prisma.governanceTransparencyLog.findMany({
    select: {
      id: true,
      receiptId: true,
      assignmentId: true,
      responseId: true,
      checksum: true,
      entryHash: true,
      previousEntryHash: true,
      timestamp: true,
      createdAt: true,
    },
    orderBy: {
      id: "desc",
    },
    take: limit,
  });
}