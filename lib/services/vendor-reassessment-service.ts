import {
  findVendor,
  updateVendor,
} from "@/lib/repositories/vendor-repository";

export type VendorReassessmentSchedule = {
  vendorId: number;
  tier: string;
  completedAt: Date;
  nextReviewDueAt: Date;
  reviewCadenceMonths: 12 | 18;
  reviewCadenceDays: 365 | 548;
};

function normalizeVendorTier(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function addUtcMonths(
  source: Date,
  months: number,
): Date {
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();

  const targetFirstDay =
    new Date(
      Date.UTC(
        year,
        month + months,
        1,
        source.getUTCHours(),
        source.getUTCMinutes(),
        source.getUTCSeconds(),
        source.getUTCMilliseconds(),
      ),
    );

  const lastDayOfTargetMonth =
    new Date(
      Date.UTC(
        targetFirstDay.getUTCFullYear(),
        targetFirstDay.getUTCMonth() + 1,
        0,
      ),
    ).getUTCDate();

  targetFirstDay.setUTCDate(
    Math.min(day, lastDayOfTargetMonth),
  );

  return targetFirstDay;
}

export async function scheduleVendorReassessment(
  input: {
    vendorId: number;
    completedAt: Date;
  },
): Promise<VendorReassessmentSchedule | null> {
  const vendor =
    await findVendor({
      where: {
        id: input.vendorId,
      },
      select: {
        id: true,
        tier: true,
        criticality: true,
        category: true,
      },
    });

  if (!vendor) {
    return null;
  }

  /*
   * Vendor.tier is authoritative.
   *
   * criticality/category are fallbacks only for older records that may
   * predate explicit tier assignment.
   */
  const tier =
    normalizeVendorTier(vendor.tier) ||
    normalizeVendorTier(vendor.criticality) ||
    normalizeVendorTier(vendor.category) ||
    "STANDARD";

  const critical =
    tier === "CRITICAL";

  const reviewCadenceMonths: 12 | 18 =
    critical ? 12 : 18;

  const reviewCadenceDays: 365 | 548 =
    critical ? 365 : 548;

  const nextReviewDueAt =
    addUtcMonths(
      input.completedAt,
      reviewCadenceMonths,
    );

  await updateVendor({
    where: {
      id: vendor.id,
    },
    data: {
      lastAssessmentCompletedAt:
        input.completedAt,
      nextReviewDueAt,
      reviewCadenceDays,
    },
  });

  return {
    vendorId: vendor.id,
    tier,
    completedAt: input.completedAt,
    nextReviewDueAt,
    reviewCadenceMonths,
    reviewCadenceDays,
  };
}
