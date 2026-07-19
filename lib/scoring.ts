// lib/scoring.ts
import prisma from "@/lib/prisma";

/**
 * Basic scoring function for a single answer.
 *
 * Notes:
 * - YES/NO questions are the strongest signal: Yes = 100, No = 0, N/A = 50.
 * - SELECT / MULTI_SELECT: if answered at all, treat as 80 (positive signal).
 * - TEXT / NUMBER: if non-empty, treat as 70 (so they contribute, but lighter).
 *
 * You can tune these later or even add per-option scoring.
 */
function scoreForAnswer(rawValue: string | null, kind: string | null) {
  if (!rawValue || !rawValue.trim()) return null;

  const value = rawValue.trim().toLowerCase();

  if (kind === "YES_NO") {
    if (["yes", "y", "true"].includes(value)) return 100;
    if (["no", "n", "false"].includes(value)) return 0;
    if (["n/a", "na", "not applicable"].includes(value)) return 50;
    return null;
  }

  if (kind === "SELECT" || kind === "MULTI_SELECT") {
    // Any non-empty selection treated as positive
    return 80;
  }

  if (kind === "NUMBER") {
    // For now, just treat "has a value" as positive; real mapping can come later
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return 70;
  }

  // TEXT or unknown
  return 70;
}

/**
 * Given a question key, infer which CIA dimension (if any) it contributes to.
 * Example keys:
 *  - "confidentiality.mfa_enabled"
 *  - "integrity.change_control"
 *  - "availability.dr_tested"
 */
function inferDimensionFromKey(
  key: string | null | undefined
): "C" | "I" | "A" | "NONE" {
  if (!key) return "NONE";
  const lower = key.toLowerCase();
  if (lower.startsWith("confidentiality.")) return "C";
  if (lower.startsWith("integrity.")) return "I";
  if (lower.startsWith("availability.")) return "A";
  return "NONE";
}

/**
 * Recalculate score for a single assessment and propagate to the vendor.
 *
 * - Updates Assessment.score, confidentialityScore, integrityScore, availabilityScore
 * - Updates AssessmentAnswer.riskImpact for each answer (0€“100)
 * - Updates Vendor.riskScore as the average of all of its completed assessments
 */
export async function recalculateAssessmentScore(assessmentId: number) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      vendor: true,
      answers: {
        include: {
          question: true,
        },
      },
    },
  });

  if (!assessment) {
    throw new Error(`Assessment ${assessmentId} not found`);
  }

  if (!assessment.vendor) {
    throw new Error(
      `Assessment ${assessmentId} has no vendor linked; cannot propagate vendor risk`
    );
  }

  // Aggregate overall + per-CIA
  let totalWeighted = 0;
  let totalWeight = 0;

  const dimTotals: Record<"C" | "I" | "A", { sum: number; weight: number }> = {
    C: { sum: 0, weight: 0 },
    I: { sum: 0, weight: 0 },
    A: { sum: 0, weight: 0 },
  };

  // We'll also collect answer-level riskImpact updates
  const answerUpdates: { id: number; riskImpact: number | null }[] = [];

  for (const answer of assessment.answers) {
    const q = answer.question;

    // Determine "kind" from richType if available, otherwise from legacy type
    let kind: string | null = null;
    if (q.richType) {
      kind = q.richType;
    } else {
      // Map legacy QuestionType -> approximate rich kind
      switch (q.type) {
        case "BOOLEAN":
          kind = "YES_NO";
          break;
        case "MULTI_CHOICE":
          kind = "SELECT";
          break;
        case "TEXT":
        default:
          kind = "TEXT";
          break;
      }
    }

    const score = scoreForAnswer(answer.value ?? null, kind);
    const weight = q.weight ?? 1; // Int weight from schema; default 1

    if (score == null || weight <= 0) {
      answerUpdates.push({ id: answer.id, riskImpact: null });
      continue;
    }

    const numericScore = Math.max(0, Math.min(100, score));

    totalWeighted += numericScore * weight;
    totalWeight += weight;

    // CIA dimension based on key prefix (confidentiality./integrity./availability.)
    const dim = inferDimensionFromKey(q.key);
    if (dim !== "NONE") {
      dimTotals[dim].sum += numericScore * weight;
      dimTotals[dim].weight += weight;
    }

    answerUpdates.push({
      id: answer.id,
      riskImpact: Math.round(numericScore),
    });
  }

  const overallScore =
    totalWeight > 0 ? Math.round(totalWeighted / totalWeight) : null;

  const cScore =
    dimTotals.C.weight > 0
      ? Math.round(dimTotals.C.sum / dimTotals.C.weight)
      : null;
  const iScore =
    dimTotals.I.weight > 0
      ? Math.round(dimTotals.I.sum / dimTotals.I.weight)
      : null;
  const aScore =
    dimTotals.A.weight > 0
      ? Math.round(dimTotals.A.sum / dimTotals.A.weight)
      : null;

  // Apply DB updates in a transaction
  await prisma.$transaction(async (tx: any) => {
    // Update assessment-level scores
    await tx.assessment.update({
      where: { id: assessment.id },
      data: {
        score: overallScore,
        confidentialityScore: cScore,
        integrityScore: iScore,
        availabilityScore: aScore,
      },
    });

    // Update each answer's riskImpact
    for (const au of answerUpdates) {
      await tx.assessmentAnswer.update({
        where: { id: au.id },
        data: {
          riskImpact: au.riskImpact,
        },
      });
    }

    // Recalculate vendor riskScore as avg of its assessments' score
    const agg = await tx.assessment.aggregate({
      where: {
        vendorId: assessment.vendorId,
        score: {
          not: null,
        },
      },
      _avg: {
        score: true,
      },
    });

    const vendorScore = agg._avg.score != null ? Math.round(agg._avg.score) : null;

    await tx.vendor.update({
      where: { id: assessment.vendorId },
      data: {
        riskScore: vendorScore,
      },
    });
  });

  return {
    assessmentId: assessment.id,
    score: overallScore,
    confidentialityScore: cScore,
    integrityScore: iScore,
    availabilityScore: aScore,
  };
}





