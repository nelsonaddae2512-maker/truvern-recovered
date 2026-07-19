import { createHash } from "node:crypto";

import type { CanonicalGovernanceArtifact } from "./canonical-governance-artifact";

export const GOVERNANCE_RELEASE_PACKAGE_SCHEMA =
  "truvern.governance_release_package.v1" as const;

export type GovernanceReleasePackageSchema =
  typeof GOVERNANCE_RELEASE_PACKAGE_SCHEMA;

export type GovernanceReleaseReviewer = {
  userId: string | null;
  name: string;
  role: string | null;
};

export type GovernanceReleaseVendor = {
  id: number | string | null;
  name: string;
  category: string | null;
  tier: string | null;
  criticality: string | null;
};

export type GovernanceReleaseAssessment = {
  assignmentId: number | string;
  requestId: number | string | null;
  responseId: number | string | null;
  organizationId: number | string | null;
  frameworkName: string | null;
  assessmentType: string | null;
  submittedAnswers: number | null;
};

export type GovernanceReleaseEvidenceSummary = {
  evidenceFiles: number;
  pendingRequests: number;
  completedRequests: number;
  missingEvidence: string[];
  reviewedEvidence: string[];
};

export type GovernanceReleaseMetadata = {
  generatedAt: string;
  releasedAt: string | null;
  confirmedAt: string | null;
  releaseState: string;
  immutable: boolean;
  packageVersion: number;
};

export type GovernanceReleasePackage = {
  schema: GovernanceReleasePackageSchema;
  packageId: string;
  packageHash: string;

  canonicalGovernanceArtifact: CanonicalGovernanceArtifact;

  executiveSummary: string;
  finalAssessment: string;
  finalRecommendation: string;
  decision: string | null;
  riskLevel: string | null;
  findings: unknown[];
  conditionsAndFollowUps: string[];
  boardSummary: string;
  customerSummary: string;

  reviewer: GovernanceReleaseReviewer;
  vendor: GovernanceReleaseVendor;
  assessment: GovernanceReleaseAssessment;
  evidenceSummary: GovernanceReleaseEvidenceSummary;
  metadata: GovernanceReleaseMetadata;
};

export type BuildGovernanceReleasePackageInput = {
  canonicalGovernanceArtifact: CanonicalGovernanceArtifact;

  reviewer?: Partial<GovernanceReleaseReviewer>;
  vendor?: Partial<GovernanceReleaseVendor>;
  assessment: Partial<GovernanceReleaseAssessment> & {
    assignmentId: number | string;
  };
  evidenceSummary?: Partial<GovernanceReleaseEvidenceSummary>;

  releasedAt?: string | Date | null;
  confirmedAt?: string | Date | null;
  releaseState?: string;
  immutable?: boolean;
  packageVersion?: number;
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text || null;
}

function safeInteger(value: unknown, fallback = 0): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.floor(numeric));
}

function nullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.max(0, Math.floor(numeric));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const text = cleanText(item);
    if (!text) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(text);
  }

  return result;
}

function isoDate(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function stableSortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortObject);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = stableSortObject(
          (value as Record<string, unknown>)[key],
        );
        return result;
      }, {});
  }

  return value;
}

function hashPayload(value: unknown): string {
  const stablePayload = JSON.stringify(stableSortObject(value));

  return createHash("sha256")
    .update(stablePayload)
    .digest("hex");
}

function packageIdentifier(input: {
  assignmentId: number | string;
  artifactGeneratedAt: string;
  packageVersion: number;
}): string {
  const source = [
    input.assignmentId,
    input.artifactGeneratedAt,
    input.packageVersion,
  ].join(":");

  return `TRV-GRP-${createHash("sha256")
    .update(source)
    .digest("hex")
    .slice(0, 20)
    .toUpperCase()}`;
}

export function buildGovernanceReleasePackage(
  input: BuildGovernanceReleasePackageInput,
): GovernanceReleasePackage {
  const generatedAt = new Date().toISOString();
  const packageVersion = Math.max(
    1,
    safeInteger(input.packageVersion, 1),
  );

  const artifact = input.canonicalGovernanceArtifact;

  if (!artifact) {
    throw new Error(
      "A canonical governance artifact is required to build a release package.",
    );
  }

  if (!cleanText(artifact.executiveSummary)) {
    throw new Error(
      "Canonical governance artifact is missing an executive summary.",
    );
  }

  if (!cleanText(artifact.finalAssessment)) {
    throw new Error(
      "Canonical governance artifact is missing a final assessment.",
    );
  }

  const reviewer: GovernanceReleaseReviewer = {
    userId: nullableText(input.reviewer?.userId),
    name:
      cleanText(input.reviewer?.name) ||
      "Truvern Reviewer",
    role: nullableText(input.reviewer?.role),
  };

  const vendor: GovernanceReleaseVendor = {
    id: input.vendor?.id ?? null,
    name:
      cleanText(input.vendor?.name) ||
      "Vendor",
    category: nullableText(input.vendor?.category),
    tier: nullableText(input.vendor?.tier),
    criticality: nullableText(input.vendor?.criticality),
  };

  const assessment: GovernanceReleaseAssessment = {
    assignmentId: input.assessment.assignmentId,
    requestId: input.assessment.requestId ?? null,
    responseId: input.assessment.responseId ?? null,
    organizationId: input.assessment.organizationId ?? null,
    frameworkName: nullableText(input.assessment.frameworkName),
    assessmentType: nullableText(input.assessment.assessmentType),
    submittedAnswers: nullableInteger(
      input.assessment.submittedAnswers,
    ),
  };

  const evidenceSummary: GovernanceReleaseEvidenceSummary = {
    evidenceFiles: safeInteger(
      input.evidenceSummary?.evidenceFiles,
    ),
    pendingRequests: safeInteger(
      input.evidenceSummary?.pendingRequests,
    ),
    completedRequests: safeInteger(
      input.evidenceSummary?.completedRequests,
    ),
    missingEvidence: stringArray(
      input.evidenceSummary?.missingEvidence,
    ),
    reviewedEvidence: stringArray(
      input.evidenceSummary?.reviewedEvidence,
    ),
  };

  const metadata: GovernanceReleaseMetadata = {
    generatedAt,
    releasedAt: isoDate(input.releasedAt),
    confirmedAt: isoDate(input.confirmedAt),
    releaseState:
      cleanText(input.releaseState) ||
      "DRAFT",
    immutable: Boolean(input.immutable),
    packageVersion,
  };

  const packageId = packageIdentifier({
    assignmentId: assessment.assignmentId,
    artifactGeneratedAt: artifact.generatedAt,
    packageVersion,
  });

  const packageWithoutHash = {
    schema: GOVERNANCE_RELEASE_PACKAGE_SCHEMA,
    packageId,
    canonicalGovernanceArtifact: artifact,
    executiveSummary: artifact.executiveSummary,
    finalAssessment: artifact.finalAssessment,
    finalRecommendation: artifact.finalRecommendation,
    decision: artifact.decision,
    riskLevel: artifact.riskLevel,
    findings: artifact.findings,
    conditionsAndFollowUps:
      artifact.conditionsAndFollowUps,
    boardSummary: artifact.boardSummary,
    customerSummary: artifact.customerSummary,
    reviewer,
    vendor,
    assessment,
    evidenceSummary,
    metadata,
  };

  const packageHash = hashPayload(packageWithoutHash);

  return {
    ...packageWithoutHash,
    packageHash,
  };
}

export function verifyGovernanceReleasePackage(
  releasePackage: GovernanceReleasePackage,
): boolean {
  const {
    packageHash,
    ...packageWithoutHash
  } = releasePackage;

  return hashPayload(packageWithoutHash) === packageHash;
}
