import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { maybePersistTransparencyCheckpoint } from "@/lib/governance/auto-checkpoint-policy";
import { generateLedgerEntry } from "@/lib/governance/transparency-ledger";


export async function readLatestGovernanceTransparencyEntryHash(): Promise<
  string | null
> {
  const row = await prisma.governanceTransparencyLog.findFirst({
    orderBy: [
      { timestamp: "desc" },
      { id: "desc" },
    ],
    select: {
      entryHash: true,
    },
  });

  const entryHash = row?.entryHash;

  return typeof entryHash === "string" && entryHash.trim()
    ? entryHash.trim()
    : null;
}

export async function persistGovernanceTransparencyLedgerEntry(
  entry: ReturnType<typeof generateLedgerEntry>,
): Promise<void> {
  await prisma.governanceTransparencyLog.createMany({
    data: [
      {
        entryId: entry.entryId,
        assignmentId: entry.assignmentId,
        responseId: entry.responseId,
        checksum: entry.checksum,
        ledgerHash: entry.ledgerHash,
        receiptId: entry.receiptId,
        timestamp: new Date(entry.timestamp),
        previousEntryHash: entry.previousEntryHash,
        entryHash: entry.entryHash,
      },
    ],
    skipDuplicates: true,
  });

  await maybePersistTransparencyCheckpoint();
}
export type ReviewReleaseAssignment = {
  id: number;
  organizationId: number;
  reviewRequestId: number | null;
  vendorId: number | null;
  vendorName: string | null;
  assignmentType?: string | null;
  type?: string | null;
  reviewerUserId?: string | null;
  assignedTo?: string | null;
  reviewerName?: string | null;
  assignedReviewerName?: string | null;
  vendorCategory?: string | null;
  vendorTier?: string | null;
  vendorCriticality?: string | null;
  [key: string]: unknown;
};

export type ReviewReleaseResponse = {
  id: number;
  reviewAssignmentId: number;
  organizationId?: number | null;
  vendorName?: string | null;
  responses: Record<string, any> | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  [key: string]: unknown;
};

export type ReviewReleaseEvidenceRequestRow = {
  id: number;
  title: string | null;
  status: string | null;
  kind: string | null;
  dueAt: Date | string | null;
  fulfilledAt: Date | string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

export async function readReviewReleaseAssignment(
  assignmentId: number,
): Promise<ReviewReleaseAssignment | null> {
  const assignment = await prisma.reviewAssignment.findUnique({
    where: {
      id: assignmentId,
    },
    include: {
      reviewRequest: {
        include: {
          vendor: true,
        },
      },
    },
  });

  if (!assignment) {
    return null;
  }

  const { reviewRequest, ...baseAssignment } = assignment;

  return {
    ...baseAssignment,
    vendorId: reviewRequest?.vendor?.id ?? baseAssignment.vendorId ?? null,
    vendorName: reviewRequest?.vendor?.name ?? null,
  } as ReviewReleaseAssignment;
}

export async function readLatestReviewReleaseResponse(
  assignmentId: number,
): Promise<ReviewReleaseResponse | null> {
  return prisma.reviewResponse.findFirst({
    where: {
      reviewAssignmentId: assignmentId,
    },
    orderBy: {
      updatedAt: "desc",
    },
  }) as Promise<ReviewReleaseResponse | null>;
}

export async function readReviewReleaseEvidenceRequests(
  vendorId: number,
): Promise<ReviewReleaseEvidenceRequestRow[]> {
  const rows = await prisma.evidenceRequest.findMany({
    where: {
      vendorId,
    },
    select: {
      id: true,
      title: true,
      status: true,
      kind: true,
      dueAt: true,
      fulfilledAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  return rows.map((row) => ({
    ...row,
    status: String(row.status),
    kind: String(row.kind),
  }));
}
export async function updateReviewResponseResponses(
  responseId: number,
  responses: unknown,
) {
  await prisma.reviewResponse.update({
    where: {
      id: responseId,
    },
    data: {
      responses: responses as any,
    },
  });
}

export type PersistVendorGovernanceMemoryInput = {
  vendorId: number;
  reviewAssignmentId: number;
  governanceScore: number | null;
  governanceDecision: string | null;
  residualRisk: string | null;
  criticalFailures: number;
  partialControls: number;
  missingEvidenceCount: number;
  remediationCount: number;
  breachDisclosureDetected: boolean;
  federalInvestigationDetected: boolean;
  governanceNarrative: string | null;
  reviewerConditions: unknown;
  attestationRequests: unknown;
  releaseConditions: unknown;
};

export async function persistVendorGovernanceMemory(
  input: PersistVendorGovernanceMemoryInput,
) {
  return prisma.vendorGovernanceMemory.create({
    data: {
      vendorId: input.vendorId,
      reviewAssignmentId: input.reviewAssignmentId,
      governanceScore: input.governanceScore,
      governanceDecision: input.governanceDecision,
      residualRisk: input.residualRisk,
      criticalFailures: input.criticalFailures,
      partialControls: input.partialControls,
      missingEvidenceCount: input.missingEvidenceCount,
      remediationCount: input.remediationCount,
      breachDisclosureDetected: input.breachDisclosureDetected,
      federalInvestigationDetected: input.federalInvestigationDetected,
      governanceNarrative: input.governanceNarrative,
      reviewerConditions:
        input.reviewerConditions as Prisma.InputJsonValue,
      attestationRequests:
        input.attestationRequests as Prisma.InputJsonValue,
      releaseConditions:
        input.releaseConditions as Prisma.InputJsonValue,
    },
  });
}

export type PersistGovernanceReleaseManifestInput = {
  organizationId: number;
  vendorId: number | null;
  reviewAssignmentId: number;
  reviewResponseId: number;
  checksum: string;
  fundingChecksum: string;
  reviewerName: string | null;
  confirmedAt: Date;
  immutableSnapshot: unknown;
};

export async function persistGovernanceReleaseManifest(
  input: PersistGovernanceReleaseManifestInput,
) {
  return prisma.governanceReleaseManifest.create({
    data: {
      organizationId: input.organizationId,
      vendorId: input.vendorId,
      assessmentRunId: null,
      reviewAssignmentId: input.reviewAssignmentId,
      reviewResponseId: input.reviewResponseId,
      manifestVersion: "GRM-1.0",
      governanceVersion: "TRV-GOV-1.0",
      releaseState: "CONFIRMED",
      checksum: input.checksum,
      packetChecksum: input.checksum,
      fundingChecksum: input.fundingChecksum,
      reviewerName: input.reviewerName,
      releasedAt: input.confirmedAt,
      confirmedAt: input.confirmedAt,
      finalizedAt: input.confirmedAt,
      immutableSnapshot:
        input.immutableSnapshot as Prisma.InputJsonValue,
    },
  });
}

export async function findGovernanceReleaseManifest<
  T extends Prisma.GovernanceReleaseManifestFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.GovernanceReleaseManifestFindFirstArgs
  >,
): Promise<
  Prisma.GovernanceReleaseManifestGetPayload<T> | null
> {
  return prisma.governanceReleaseManifest.findFirst(args);
}
