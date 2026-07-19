// lib/vendor-health-sync.ts
import prisma from "@/lib/prisma";

function clampScore(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

/**
 * Recomputes vendor.riskScore as the average of all scored assessments
 * for a given vendorId.
 *
 * - Only looks at assessments where score is NOT null
 * - If there are no scored assessments, it leaves vendor.riskScore unchanged
 */
export async function syncVendorHealthForVendor(vendorId: number) {
  if (!vendorId || Number.isNaN(Number(vendorId))) return;

  // Compute avg score for this vendor's assessments
  const result = await prisma.assessment.aggregate({
    _avg: {
      score: true,
    },
    where: {
      vendorId,
      score: {
        not: null,
      },
    },
  });

  const avgScore = result._avg.score;

  // If no scored assessments, do nothing €” keep existing riskScore as-is
  if (avgScore == null) {
    return;
  }

  const clamped = clampScore(avgScore);

  if (clamped == null) {
    return;
  }

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      riskScore: clamped,
    },
  });
}




