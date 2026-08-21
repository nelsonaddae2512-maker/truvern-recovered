import "server-only";

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type GovernanceSeverity =
  | "INFO"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type GovernanceScoreComponent = {
  category: string;
  weight: number;
  rawRisk: number;
  deduction: number;
  score: number;
  rootCauseCount: number;
  occurrenceCount: number;
};

export type GovernanceRootCause = {
  id: string;
  category: string;
  ruleId: string;
  ownershipArea: string;
  centralAsset: string | null;
  title: string;
  severity: GovernanceSeverity;
  confidence: number;
  findingCount: number;
  occurrenceCount: number;
  assets: string[];
  evidence: string[];
  remediation: string;
  estimatedScoreGain: number;
  impactScore: number;
};

export type RepositoryGovernanceResult = {
  generatedAt: string;
  schemaVersion: 3;
  engineVersion: "ATLAS-06B.2";
  status:
    | "HEALTHY"
    | "ATTENTION"
    | "REVIEW_REQUIRED"
    | "BLOCKED";
  score: number;
  enforceable: boolean;
  blockingReasons: string[];
  summary: {
    nodes: number;
    edges: number;
    cycles: number;
    rawOccurrences: number;
    detailedFindings: number;
    architecturalRootCauses: number;
    actionableFindings: number;
    repositoryFiles: number;
    testFiles: number;
    documentationFiles: number;
    consolidationPercent: number;
  };
  severityCounts: Record<GovernanceSeverity, number>;
  categoryCounts: Record<string, number>;
  scoreComponents: GovernanceScoreComponent[];
  rootCauses: GovernanceRootCause[];
  violations: GovernanceRootCause[];
  recommendations: Array<{
    title: string;
    ruleId: string;
    severity: GovernanceSeverity;
    ownershipArea: string;
    centralAsset: string | null;
    affectedFindings: number;
    affectedOccurrences: number;
    estimatedScoreGain: number;
    action: string;
  }>;
};

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "tools", "atlas", "output", "repository-governance.json");
const enginePath = path.join(repoRoot, "tools", "atlas", "repository-governance.js");
const graphPath = path.join(repoRoot, "tools", "atlas", "output", "explorer-graph.json");
const rulesPath = path.join(repoRoot, "tools", "atlas", "repository-governance.rules.json");

function newestDependencyTimestamp(): number {
  return Math.max(
    fs.statSync(enginePath).mtimeMs,
    fs.statSync(graphPath).mtimeMs,
    fs.statSync(rulesPath).mtimeMs,
  );
}

function ensureCurrentAssessment(): void {
  const outputIsCurrent =
    fs.existsSync(outputPath) &&
    fs.statSync(outputPath).mtimeMs >= newestDependencyTimestamp();

  if (outputIsCurrent) return;

  execFileSync(process.execPath, [enginePath, "report"], {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8",
    timeout: 120_000,
  });
}

export function getRepositoryGovernance(): RepositoryGovernanceResult {
  if (!fs.existsSync(enginePath)) {
    throw new Error("ATLAS Repository Governance engine is unavailable.");
  }
  if (!fs.existsSync(graphPath)) {
    throw new Error("ATLAS explorer graph is unavailable.");
  }
  if (!fs.existsSync(rulesPath)) {
    throw new Error("ATLAS Repository Governance policy is unavailable.");
  }

  ensureCurrentAssessment();

  const parsed = JSON.parse(
    fs.readFileSync(outputPath, "utf8"),
  ) as RepositoryGovernanceResult;

  if (
    parsed.schemaVersion !== 3 ||
    parsed.engineVersion !== "ATLAS-06B.2"
  ) {
    throw new Error(
      "ATLAS Repository Governance output is not compatible with Architectural Root Cause Intelligence.",
    );
  }

  return parsed;
}
