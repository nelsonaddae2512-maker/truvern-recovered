import "server-only";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type PortfolioOptimizerResult = {
  generatedAt: string;
  schemaVersion: 1;
  engineVersion: "ATLAS-07A";
  sourcePlannerEngine: "ATLAS-07";
  repositoryScore: number;
  repositoryStatus: string;
  summary: {
    plansAnalyzed: number;
    originalEstimatedHours: number;
    overlapSavingsHours: number;
    coordinationOverheadHours: number;
    optimizedEstimatedHours: number;
    savingsPercent: number;
    mergeCandidates: number;
    dependencyLinks: number;
    phases: number;
    potentialScoreGain: number;
    projectedMaximumScore: number;
  };
  safestFirstPlan: {
    id: string;
    title: string;
    risk: "LOW" | "MEDIUM" | "HIGH";
    effortHours: number;
    estimatedScoreGain: number;
  } | null;
  dependencies: Array<{ before: string; after: string; strength: number; reason: string }>;
  phases: Array<{
    phase: number;
    label: string;
    planIds: string[];
    planCount: number;
    affectedFiles: string[];
    affectedFileCount: number;
    estimatedHoursBeforeOverlap: number;
    potentialScoreGain: number;
    riskCounts: { HIGH: number; MEDIUM: number; LOW: number };
  }>;
  executionOrder: string[];
};

const root = process.cwd();
const output = path.join(root, "tools", "atlas", "output", "refactoring-portfolio.json");
const engine = path.join(root, "tools", "atlas", "portfolio-optimizer.js");
const planner = path.join(root, "tools", "atlas", "output", "refactoring-plan.json");
const rules = path.join(root, "tools", "atlas", "portfolio-optimizer.rules.json");

export function getRefactoringPortfolio(): PortfolioOptimizerResult {
  for (const required of [engine, planner, rules]) {
    if (!fs.existsSync(required)) throw new Error(`ATLAS Portfolio Optimizer prerequisite missing: ${required}`);
  }
  const newest = Math.max(fs.statSync(engine).mtimeMs, fs.statSync(planner).mtimeMs, fs.statSync(rules).mtimeMs);
  if (!fs.existsSync(output) || fs.statSync(output).mtimeMs < newest) {
    execFileSync(process.execPath, [engine, "report"], { cwd: root, stdio: "pipe", encoding: "utf8", timeout: 120000 });
  }
  const result = JSON.parse(fs.readFileSync(output, "utf8")) as PortfolioOptimizerResult;
  if (result.schemaVersion !== 1 || result.engineVersion !== "ATLAS-07A") {
    throw new Error("ATLAS Portfolio Optimizer output is incompatible.");
  }
  return result;
}
