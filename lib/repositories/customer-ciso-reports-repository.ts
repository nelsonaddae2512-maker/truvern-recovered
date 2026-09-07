import prisma from "@/lib/prisma";

export type CustomerCisoReportRow = {
  id: number;
  reviewAssignmentId: number;
  vendorId: number;
  vendorName: string;
  releaseState: string;
  releasedAt: Date | null;
  confirmedAt: Date | null;
  finalizedAt: Date | null;
  createdAt: Date;
};

export async function readCustomerCisoReports(
  organizationId: number,
): Promise<CustomerCisoReportRow[]> {
  const rows =
    await prisma.governanceReleaseManifest.findMany({
      where: {
        organizationId,
        releaseState: {
          in: [
            "RELEASED",
            "CONFIRMED",
          ],
        },
      },
      select: {
        id: true,
        reviewAssignmentId: true,
        vendorId: true,
        releaseState: true,
        releasedAt: true,
        confirmedAt: true,
        finalizedAt: true,
        createdAt: true,
      },
      orderBy: [
        {
          releasedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

  const eligibleRows =
    rows.filter(
      (
        row,
      ): row is typeof row & {
        reviewAssignmentId: number;
        vendorId: number;
      } =>
        row.reviewAssignmentId != null &&
        row.vendorId != null,
    );

  if (eligibleRows.length === 0) {
    return [];
  }

  const vendorIds =
    Array.from(
      new Set(
        eligibleRows.map(
          (row) =>
            row.vendorId,
        ),
      ),
    );

  const vendors =
    await prisma.vendor.findMany({
      where: {
        organizationId,
        id: {
          in: vendorIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

  const vendorNames =
    new Map(
      vendors.map(
        (vendor) => [
          vendor.id,
          vendor.name,
        ],
      ),
    );

  return eligibleRows.map(
    (row) => ({
      ...row,
      vendorName:
        vendorNames.get(
          row.vendorId,
        ) ??
        `Vendor ${row.vendorId}`,
    }),
  );
}

export type CustomerFinalReleaseManifestRow = {
  id: number;
  reviewAssignmentId: number;
  organizationId: number;
  releaseState: string;
};

export async function readCustomerFinalReleaseManifest(input: {
  organizationId: number;
  reviewAssignmentId: number;
}): Promise<CustomerFinalReleaseManifestRow | null> {
  const manifest =
    await prisma.governanceReleaseManifest.findFirst({
      where: {
        organizationId:
          input.organizationId,
        reviewAssignmentId:
          input.reviewAssignmentId,
        releaseState: {
          in: [
            "RELEASED",
            "CONFIRMED",
          ],
        },
      },
      select: {
        id: true,
        reviewAssignmentId: true,
        organizationId: true,
        releaseState: true,
      },
      orderBy: [
        {
          confirmedAt: "desc",
        },
        {
          releasedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

  if (
    !manifest ||
    manifest.reviewAssignmentId == null
  ) {
    return null;
  }

  return {
    id: manifest.id,
    reviewAssignmentId:
      manifest.reviewAssignmentId,
    organizationId:
      manifest.organizationId,
    releaseState:
      manifest.releaseState,
  };
}
