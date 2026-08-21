import prisma from "@/lib/prisma";

export type ReceiptVerificationEntry = {
  id: number;
  entryId: string | null;
  assignmentId: number | null;
  responseId: number | null;
  checksum: string | null;
  ledgerHash: string | null;
  receiptId: string | null;
  timestamp: Date | string | null;
  previousEntryHash: string | null;
  entryHash: string | null;
  createdAt: Date;
};

export async function readReceiptVerificationEntry(
  receiptId: string,
): Promise<ReceiptVerificationEntry | null> {
  return prisma.governanceTransparencyLog.findFirst({
    where: {
      receiptId,
    },
    select: {
      id: true,
      entryId: true,
      assignmentId: true,
      responseId: true,
      checksum: true,
      ledgerHash: true,
      receiptId: true,
      timestamp: true,
      previousEntryHash: true,
      entryHash: true,
      createdAt: true,
    },
  });
}