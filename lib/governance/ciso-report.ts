export const CISO_REPORT_VERSION =
  "TRV-CISO-REPORT-1.0" as const;

export const CISO_REPORT_TITLE =
  "Truvern Third-Party Cyber Risk Assessment Report" as const;

type UnknownRecord = Record<string, unknown>;

export type CisoFindingSeverity =
  | "CRITICAL"
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "INFO"
  | "UNKNOWN";

export type CisoRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL"
  | "UNKNOWN";

export type CisoReportFinding = {
  controlId: string | null;
  controlFamily: string | null;
  title: string;
  severity: CisoFindingSeverity;
  status: string | null;
  recommendation: string | null;
  remediationRequired: boolean;
  attestationRequired: boolean;
  dueAt: string | null;
};

export type CisoControlFamilyPosture = {
  family: string;
  findingCount: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
};

export type CisoReportProjection = {
  schema: typeof CISO_REPORT_VERSION;
  title: typeof CISO_REPORT_TITLE;

  assignmentId: number;
  vendorName: string;
  vendorCategory: string | null;

  decision: string;
  residualRisk: CisoRiskLevel;
  releaseState: string;

  executiveSummary: string;
  finalRecommendation: string;
  conditionsAndFollowUps: string[];

  findings: CisoReportFinding[];
  findingSummary: {
    total: number;
    open: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    informational: number;
    unknown: number;
  };

  remediationSummary: {
    total: number;
    open: number;
    overdue: number;
  };

  attestationSummary: {
    total: number;
    open: number;
  };

  evidenceSummary: {
    artifactCount: number;
  };

  controlFamilyCoverage:
    | "RECORDED"
    | "PARTIAL"
    | "NOT_RECORDED";

  controlFamilies: CisoControlFamilyPosture[];
};

export type BuildCisoReportProjectionInput = {
  assignmentId: number;
  vendorName?: unknown;
  vendorCategory?: unknown;

  responses?: unknown;
  governanceReleasePackage?: unknown;
  canonicalGovernanceArtifact?: unknown;

  evidenceCount?: number;

  remediation?: unknown[];
  attestations?: unknown[];

  asOf?: string | Date | null;
};

function record(value: unknown): UnknownRecord {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const normalized = text(value);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function boolean(value: unknown): boolean {
  return value === true;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value)
    ? value
    : [];
}

function dateText(value: unknown): string | null {
  if (
    typeof value !== "string" &&
    !(value instanceof Date)
  ) {
    return null;
  }

  const parsed =
    new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString();
}

function normalizeSeverity(
  value: unknown,
): CisoFindingSeverity {
  const normalized =
    text(value).toUpperCase();

  if (normalized === "CRITICAL") {
    return "CRITICAL";
  }

  if (normalized === "HIGH") {
    return "HIGH";
  }

  if (
    normalized === "MODERATE" ||
    normalized === "MEDIUM"
  ) {
    return "MODERATE";
  }

  if (normalized === "LOW") {
    return "LOW";
  }

  if (
    normalized === "INFO" ||
    normalized === "INFORMATIONAL"
  ) {
    return "INFO";
  }

  return "UNKNOWN";
}

function normalizeRisk(
  value: unknown,
): CisoRiskLevel {
  const normalized =
    text(value).toUpperCase();

  if (
    normalized === "LOW" ||
    normalized === "MEDIUM" ||
    normalized === "HIGH" ||
    normalized === "CRITICAL"
  ) {
    return normalized;
  }

  return "UNKNOWN";
}

function isClosedStatus(value: unknown): boolean {
  const normalized =
    text(value).toUpperCase();

  return [
    "CLOSED",
    "COMPLETE",
    "COMPLETED",
    "RESOLVED",
    "REMEDIATED",
    "ACCEPTED",
    "APPROVED",
    "VERIFIED",
  ].includes(normalized);
}

function conditionsFrom(
  ...values: unknown[]
): string[] {
  for (const value of values) {
    if (!Array.isArray(value)) {
      continue;
    }

    const normalized =
      value
        .map(text)
        .filter(Boolean);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

function findingsFrom(
  ...values: unknown[]
): unknown[] {
  for (const value of values) {
    if (
      Array.isArray(value) &&
      value.length > 0
    ) {
      return value;
    }
  }

  return [];
}

function projectFinding(
  value: unknown,
): CisoReportFinding {
  const finding =
    record(value);

  return {
    controlId:
      firstText(
        finding.controlId,
        finding.controlKey,
      ) || null,

    controlFamily:
      firstText(
        finding.controlFamily,
        finding.family,
      ) || null,

    title:
      firstText(
        finding.title,
        finding.description,
      ) || "Untitled finding",

    severity:
      normalizeSeverity(
        finding.severity,
      ),

    status:
      text(finding.status) || null,

    recommendation:
      firstText(
        finding.recommendation,
        finding.remediation,
      ) || null,

    remediationRequired:
      boolean(
        finding.remediationRequired,
      ),

    attestationRequired:
      boolean(
        finding.attestationRequired,
      ),

    dueAt:
      dateText(
        finding.dueAt,
      ),
  };
}

function buildFindingSummary(
  findings: CisoReportFinding[],
): CisoReportProjection["findingSummary"] {
  const summary = {
    total: findings.length,
    open: 0,
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    informational: 0,
    unknown: 0,
  };

  for (const finding of findings) {
    if (!isClosedStatus(finding.status)) {
      summary.open += 1;
    }

    switch (finding.severity) {
      case "CRITICAL":
        summary.critical += 1;
        break;

      case "HIGH":
        summary.high += 1;
        break;

      case "MODERATE":
        summary.moderate += 1;
        break;

      case "LOW":
        summary.low += 1;
        break;

      case "INFO":
        summary.informational += 1;
        break;

      default:
        summary.unknown += 1;
        break;
    }
  }

  return summary;
}

function buildControlFamilies(
  findings: CisoReportFinding[],
): {
  coverage:
    | "RECORDED"
    | "PARTIAL"
    | "NOT_RECORDED";
  rows: CisoControlFamilyPosture[];
} {
  const grouped =
    new Map<string, CisoControlFamilyPosture>();

  let recorded =
    0;

  for (const finding of findings) {
    const family =
      text(finding.controlFamily);

    if (!family) {
      continue;
    }

    recorded += 1;

    const current =
      grouped.get(family) ?? {
        family,
        findingCount: 0,
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
      };

    current.findingCount += 1;

    switch (finding.severity) {
      case "CRITICAL":
        current.critical += 1;
        break;

      case "HIGH":
        current.high += 1;
        break;

      case "MODERATE":
        current.moderate += 1;
        break;

      case "LOW":
        current.low += 1;
        break;
    }

    grouped.set(
      family,
      current,
    );
  }

  const coverage =
    recorded === 0
      ? "NOT_RECORDED"
      : recorded === findings.length
        ? "RECORDED"
        : "PARTIAL";

  return {
    coverage,
    rows:
      Array.from(grouped.values())
        .sort((a, b) =>
          a.family.localeCompare(b.family),
        ),
  };
}

function summarizeLifecycle(
  values: unknown[],
): {
  total: number;
  open: number;
} {
  let open =
    0;

  for (const value of values) {
    const row =
      record(value);

    if (!isClosedStatus(row.status)) {
      open += 1;
    }
  }

  return {
    total: values.length,
    open,
  };
}

function overdueRemediationCount(
  values: unknown[],
  asOf: string | Date | null | undefined,
): number {
  const asOfText =
    dateText(asOf);

  if (!asOfText) {
    return 0;
  }

  const asOfTime =
    new Date(asOfText).getTime();

  return values.reduce<number>(
    (count, value) => {
      const row =
        record(value);

      if (isClosedStatus(row.status)) {
        return count;
      }

      const dueAt =
        dateText(row.dueAt);

      if (
        dueAt &&
        new Date(dueAt).getTime() < asOfTime
      ) {
        return count + 1;
      }

      return count;
    },
    0,
  );
}

export function buildCisoReportProjection(
  input: BuildCisoReportProjectionInput,
): CisoReportProjection {
  const responses =
    record(input.responses);

  const releasePackage =
    record(
      input.governanceReleasePackage ??
      responses.governanceReleasePackage,
    );

  const canonicalArtifact =
    record(
      input.canonicalGovernanceArtifact ??
      releasePackage.canonicalGovernanceArtifact ??
      responses.canonicalGovernanceArtifact,
    );

  const findings =
    findingsFrom(
      releasePackage.findings,
      canonicalArtifact.findings,
      responses.findings,
    ).map(projectFinding);

  const remediation =
    array(input.remediation);

  const attestations =
    array(input.attestations);

  const remediationLifecycle =
    summarizeLifecycle(remediation);

  const attestationLifecycle =
    summarizeLifecycle(attestations);

  const controlFamilyPosture =
    buildControlFamilies(findings);

  return {
    schema:
      CISO_REPORT_VERSION,

    title:
      CISO_REPORT_TITLE,

    assignmentId:
      input.assignmentId,

    vendorName:
      text(input.vendorName) ||
      "Vendor",

    vendorCategory:
      text(input.vendorCategory) ||
      null,

    decision:
      firstText(
        releasePackage.decision,
        canonicalArtifact.decision,
        responses.decision,
      ) || "Not recorded",

    residualRisk:
      normalizeRisk(
        firstText(
          releasePackage.riskLevel,
          canonicalArtifact.riskLevel,
          responses.riskLevel,
        ),
      ),

    releaseState:
      firstText(
        record(releasePackage.metadata).releaseState,
        responses.releaseState,
      ) || "Not recorded",

    executiveSummary:
      firstText(
        releasePackage.executiveSummary,
        canonicalArtifact.executiveSummary,
        responses.executiveSummary,
      ) || "Not recorded",

    finalRecommendation:
      firstText(
        releasePackage.finalRecommendation,
        releasePackage.finalAssessment,
        canonicalArtifact.finalRecommendation,
        canonicalArtifact.finalAssessment,
        responses.finalRecommendation,
        responses.finalAssessment,
      ) || "Not recorded",

    conditionsAndFollowUps:
      conditionsFrom(
        releasePackage.conditionsAndFollowUps,
        canonicalArtifact.conditionsAndFollowUps,
        responses.conditionsAndFollowUps,
      ),

    findings,

    findingSummary:
      buildFindingSummary(findings),

    remediationSummary: {
      ...remediationLifecycle,
      overdue:
        overdueRemediationCount(
          remediation,
          input.asOf,
        ),
    },

    attestationSummary:
      attestationLifecycle,

    evidenceSummary: {
      artifactCount:
        Math.max(
          0,
          Number.isFinite(input.evidenceCount)
            ? Number(input.evidenceCount)
            : 0,
        ),
    },

    controlFamilyCoverage:
      controlFamilyPosture.coverage,

    controlFamilies:
      controlFamilyPosture.rows,
  };
}