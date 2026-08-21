import "server-only";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type PatchGeneratorResult = {
  generatedAt: string;
  schemaVersion: 1;
  engineVersion: "ATLAS-08";
  mode: "REVIEW_ONLY";
  repositoryScore: number;
  repositoryStatus: string;
  summary: {
    phases: number;
    patchesGenerated: number;
    affectedFiles: number;
    estimatedHours: number;
    estimatedScoreGain: number;
    highRiskPatches: number;
    mediumRiskPatches: number;
    lowRiskPatches: number;
  };
  executionOrder: string[];
  patches: Array<{
    id: string;
    phase: number;
    phaseLabel: string;
    sourcePlanId: string;
    title: string;
    status: "PROPOSED";
    mode: "REVIEW_ONLY";
    risk: "LOW" | "MEDIUM" | "HIGH";
    recommendedOwner: string;
    ownershipArea: string;
    affectedFiles: string[];
    affectedFileCount: number;
    estimatedHours: number;
    estimatedScoreGain: number;
    instructions: string[];
    validationCommands: string[];
    rollback: string[];
    reviewChecklist: string[];
  }>;
};

const root = process.cwd();
const output = path.join(root, "tools", "atlas", "output", "patch-plan.json");
const engine = path.join(root, "tools", "atlas", "patch-generator.js");
const portfolio = path.join(root, "tools", "atlas", "output", "refactoring-portfolio.json");
const planner = path.join(root, "tools", "atlas", "output", "refactoring-plan.json");
const rules = path.join(root, "tools", "atlas", "patch-generator.rules.json");

export function getPatchPlan(): PatchGeneratorResult {
  for (const required of [engine, portfolio, planner, rules]) {
    if (!fs.existsSync(required)) throw new Error(`ATLAS Patch Generator prerequisite missing: ${required}`);
  }
  const newest = Math.max(
    fs.statSync(engine).mtimeMs,
    fs.statSync(portfolio).mtimeMs,
    fs.statSync(planner).mtimeMs,
    fs.statSync(rules).mtimeMs,
  );
  if (!fs.existsSync(output) || fs.statSync(output).mtimeMs < newest) {
    execFileSync(process.execPath, [engine, "report"], {
      cwd: root,
      stdio: "pipe",
      encoding: "utf8",
      timeout: 120000,
    });
  }
  const result = JSON.parse(fs.readFileSync(output, "utf8")) as PatchGeneratorResult;
  if (result.schemaVersion !== 1 || result.engineVersion !== "ATLAS-08" || result.mode !== "REVIEW_ONLY") {
    throw new Error("ATLAS Patch Generator output is incompatible.");
  }
  return result;
}
