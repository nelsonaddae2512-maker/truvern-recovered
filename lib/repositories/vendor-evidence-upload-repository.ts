import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type VendorEvidenceUploadClient = Pick<
  Prisma.TransactionClient,
  "evidenceRequest" | "evidence" | "remediationPackage"
>;

export async function findVendorEvidenceRequest(
  input: {
    evidenceRequestId: number;
    vendorId: number;
  },
  client: VendorEvidenceUploadClient = prisma,
) {
  return client.evidenceRequest.findFirst({
    where: {
      id: input.evidenceRequestId,
      vendorId: input.vendorId,
    },
    select: {
      id: true,
      vendorId: true,
      organizationId: true,
      title: true,
      kind: true,
    },
  });
}

export async function createVendorEvidenceUpload(
  input: {
    vendorId: number;
    organizationId: number;
    kind: string;
    title: string;
    notes: string;
    storedUrl: string;
    evidenceRequestId: number;
  },
  client: VendorEvidenceUploadClient = prisma,
) {
  const now = new Date();

  return client.evidence.create({
    data: {
      vendorId: input.vendorId,
      organizationId: input.organizationId,
      kind: input.kind as Prisma.EvidenceUncheckedCreateInput["kind"],
      title: input.title,
      notes: input.notes,
      url: input.storedUrl,
      fileUrl: input.storedUrl,
      evidenceRequestId: input.evidenceRequestId,
      createdAt: now,
      updatedAt: now,
    },
    select: {
      id: true,
    },
  });
}

export async function fulfillVendorEvidenceRequest(
  input: {
    evidenceRequestId: number;
    evidenceId: number;
  },
  client: VendorEvidenceUploadClient = prisma,
) {
  const now = new Date();

  return client.evidenceRequest.update({
    where: {
      id: input.evidenceRequestId,
    },
    data: {
      status: "SUBMITTED",
      fulfilledEvidenceId: input.evidenceId,
      fulfilledAt: now,
      updatedAt: now,
    },
    select: {
      id: true,
    },
  });
}

export async function findRemediationPackageForEvidenceRequest(
  input: {
    evidenceRequestId: number;
  },
  client: VendorEvidenceUploadClient = prisma,
) {
  return client.remediationPackage.findFirst({
    where: {
      evidenceRequestId: input.evidenceRequestId,
    },
    select: {
      id: true,
    },
  });
}