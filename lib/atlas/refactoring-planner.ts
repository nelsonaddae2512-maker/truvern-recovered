import "server-only";

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type RefactoringRisk = {
  level: "LOW" | "MEDIUM" | "HIGH";
  score: number;
  maxImpact: number;
};

export type RefactoringStep = {
  order: number;
  title: string;
  description: string;
  validation: string;
};

export type RefactoringPlan = {
  id: string;
  priority: number;
  title: string;
  rootCauseId: string;
  ruleId: string;
  category: string;
  severity: string;
  ownershipArea: string;
  recommendedOwner: string;
  centralAsset: string | null;
  affectedFiles: string[];
  affectedFileCount: number;
  affectedEdgeCount: number;
  affectedOccurrences: number;
  regressionRisk: RefactoringRisk;
  effort: {
    minutes: number;
    hours: number;
    label: string;
  };
  tests: {
    files: string[];
    commands: string[];
    missingFocusedCoverage: boolean;
  };
  steps: RefactoringStep[];
  rollback: string[];
  estimatedScoreGain: number;
  projectedRepositoryScore: number;
  releaseImpact: string;
};

export type RefactoringPlannerResult = {
  generatedAt: string;
  schemaVersion: 1;
  engineVersion: "ATLAS-07";
  sourceGovernanceEngine: "ATLAS-06B.2";
  repositoryScore: number;
  repositoryStatus: string;
  summary: {
    rootCausesAvailable: number;
    plansGenerated: number;
    totalAffectedFiles: number;
    totalEstimatedHours: number;
    potentialScoreGain: number;
    projectedMaximumScore: number;
    highRiskPlans: number;
    mediumRiskPlans: number;
    lowRiskPlans: number;
  };
  executionOrder: string[];
  plans: RefactoringPlan[];
};

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "tools", "atlas", "output", "refactoring-plan.json");
const enginePath = path.join(repoRoot, "tools", "atlas", "refactoring-planner.js");
const governancePath = path.join(repoRoot, "tools", "atlas", "output", "repository-governance.json");
const graphPath = path.join(repoRoot, "tools", "atlas", "output", "explorer-graph.json");
const rulesPath = path.join(repoRoot, "tools", "atlas", "refactoring-planner.rules.json");

function newestDependencyTimestamp(): number {
  return Math.max(
    fs.statSync(enginePath).mtimeMs,
    fs.statSync(governancePath).mtimeMs,
    fs.statSync(graphPath).mtimeMs,
    fs.statSync(rulesPath).mtimeMs,
  );
}

function ensureCurrentPlan(): void {
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

export function getRefactoringPlanner(): RefactoringPlannerResult {
  for (const required of [enginePath, governancePath, graphPath, rulesPath]) {
    if (!fs.existsSync(required)) {
      throw new Error(`ATLAS Refactoring Planner prerequisite is unavailable: ${required}`);
    }
  }

  ensureCurrentPlan();

  const parsed = JSON.parse(
    fs.readFileSync(outputPath, "utf8"),
  ) as RefactoringPlannerResult;

  if (
    parsed.schemaVersion !== 1 ||
    parsed.engineVersion !== "ATLAS-07"
  ) {
    throw new Error("ATLAS Refactoring Planner output is incompatible.");
  }

  return parsed;
}
