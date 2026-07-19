export type TruvernAnswerValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | string[]
  | Record<string, unknown>;

export type TruvernScoringInput = {
  questionId?: number | string;
  controlId?: number | string | null;
  controlCode?: string | null;
  family?: string | null;
  prompt?: string | null;
  answer?: TruvernAnswerValue;
  score?: number | null;
  maxScore?: number | null;
  weight?: number | null;
  requiresEvidence?: boolean | null;
  requiresAttestation?: boolean | null;
  evidence?: unknown;
};

export type TruvernControlScore = {
  controlKey: string;
  controlCode: string | null;
  family: string | null;
  score: number;
  maxScore: number;
  percent: number;
  answeredQuestions: number;
  totalQuestions: number;
  missingEvidence: number;
  requiresAttestation: boolean;
};

export type TruvernAssessmentScore = {
  score: number;
  maxScore: number;
  percent: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  completedQuestions: number;
  totalQuestions: number;
  missingEvidence: number;
  controls: TruvernControlScore[];
};

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function hasAnswer(answer: TruvernAnswerValue): boolean {
  if (answer === null || answer === undefined) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  if (Array.isArray(answer)) return answer.length > 0;
  if (typeof answer === "object") return Object.keys(answer).length > 0;
  return true;
}

function hasEvidence(evidence: unknown): boolean {
  if (evidence === null || evidence === undefined) return false;
  if (typeof evidence === "string") return evidence.trim().length > 0;
  if (Array.isArray(evidence)) return evidence.length > 0;
  if (typeof evidence === "object") return Object.keys(evidence as Record<string, unknown>).length > 0;
  return true;
}

export function normalizeAnswerScore(item: TruvernScoringInput): {
  score: number;
  maxScore: number;
  answered: boolean;
} {
  const weight = Math.max(1, asNumber(item.weight, 1));
  const maxScore = Math.max(1, asNumber(item.maxScore, weight));
  const answered = hasAnswer(item.answer);

  if (typeof item.score === "number" && Number.isFinite(item.score)) {
    return {
      score: Math.max(0, Math.min(item.score, maxScore)),
      maxScore,
      answered,
    };
  }

  if (!answered) {
    return { score: 0, maxScore, answered: false };
  }

  const answer = item.answer;

  if (typeof answer === "boolean") {
    return { score: answer ? maxScore : 0, maxScore, answered: true };
  }

  if (typeof answer === "number") {
    return {
      score: Math.max(0, Math.min(answer, maxScore)),
      maxScore,
      answered: true,
    };
  }

  if (typeof answer === "string") {
    const normalized = answer.trim().toLowerCase();

    if (["yes", "y", "true", "implemented", "complete", "compliant", "pass"].includes(normalized)) {
      return { score: maxScore, maxScore, answered: true };
    }

    if (
      [
        "partial",
        "partially",
        "in progress",
        "planned",
        "compensating control",
        "under development",
        "roadmap",
        "future",
        "future state"
      ].includes(normalized)
    ) {
      return { score: Math.round(maxScore * 0.35), maxScore, answered: true };
    }

    if (
      [
        "no",
        "n",
        "false",
        "not implemented",
        "fail",
        "non-compliant",
        "none",
        "unknown",
        "n/a",
        "not available"
      ].includes(normalized)
    ) {
      return { score: 0, maxScore, answered: true };
    }

    if (
      normalized.includes("upon request") ||
      normalized.includes("planned") ||
      normalized.includes("working on") ||
      normalized.includes("not yet") ||
      normalized.includes("future") ||
      normalized.includes("roadmap") ||
      normalized.includes("draft") ||
      normalized.includes("to be implemented")
    ) {
      return { score: Math.round(maxScore * 0.25), maxScore, answered: true };
    }

    if (
      normalized.includes("documented") ||
      normalized.includes("implemented") ||
      normalized.includes("audited") ||
      normalized.includes("validated") ||
      normalized.includes("monitored") ||
      normalized.includes("enforced")
    ) {
      return { score: Math.round(maxScore * 0.9), maxScore, answered: true };
    }

    return { score: Math.round(maxScore * 0.45), maxScore, answered: true };
  }

  return { score: maxScore, maxScore, answered: true };
}

export function calculateRiskLevel(percent: number): TruvernAssessmentScore["riskLevel"] {
  if (percent >= 85) return "LOW";
  if (percent >= 65) return "MODERATE";
  if (percent >= 45) return "HIGH";
  return "CRITICAL";
}

export function scoreAssessment(items: TruvernScoringInput[]): TruvernAssessmentScore {
  const controlMap = new Map<string, TruvernControlScore>();

  let score = 0;
  let maxScore = 0;
  let completedQuestions = 0;
  let missingEvidence = 0;

  for (const item of items) {
    const normalized = normalizeAnswerScore(item);
    const controlKey = String(item.controlId ?? item.controlCode ?? "unmapped");
    const existing =
      controlMap.get(controlKey) ??
      ({
        controlKey,
        controlCode: item.controlCode ?? null,
        family: item.family ?? null,
        score: 0,
        maxScore: 0,
        percent: 0,
        answeredQuestions: 0,
        totalQuestions: 0,
        missingEvidence: 0,
        requiresAttestation: false,
      } satisfies TruvernControlScore);

    score += normalized.score;
    maxScore += normalized.maxScore;

    existing.score += normalized.score;
    existing.maxScore += normalized.maxScore;
    existing.totalQuestions += 1;

    if (normalized.answered) {
      completedQuestions += 1;
      existing.answeredQuestions += 1;
    }

    if (item.requiresEvidence && !hasEvidence(item.evidence)) {
      missingEvidence += 1;
      existing.missingEvidence += 1;
    }

    if (item.requiresAttestation) {
      existing.requiresAttestation = true;
    }

    existing.percent =
      existing.maxScore > 0 ? Math.round((existing.score / existing.maxScore) * 100) : 0;

    controlMap.set(controlKey, existing);
  }

  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    score,
    maxScore,
    percent,
    riskLevel: calculateRiskLevel(percent),
    completedQuestions,
    totalQuestions: items.length,
    missingEvidence,
    controls: Array.from(controlMap.values()).sort((a, b) =>
      String(a.controlCode ?? a.controlKey).localeCompare(String(b.controlCode ?? b.controlKey)),
    ),
  };
}


