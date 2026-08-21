import "server-only";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export interface DependencyAwareTestPlan {
  generatedAt: string;
  schemaVersion: number;
  engineVersion: string;
  mode: string;
  sourceEngineVersion: string;
  summary: {
    targetsPlanned: number;
    totalScenarios: number;
    dependenciesClassified: number;
    fixturesInferred: number;
    stateTransitionsInferred: number;
    sideEffectsIdentified: number;
  };
  plans: unknown[];
}

const root = process.cwd();

const engine = path.join(
  root,
  "tools",
  "atlas",
  "test-planner.js",
);

const output = path.join(
  root,
  "tools",
  "atlas",
  "output",
  "dependency-aware-test-plan.json",
);

export function refreshDependencyAwareTestPlan(): DependencyAwareTestPlan {
  execFileSync(
    process.execPath,
    [engine, "report"],
    {
      cwd: root,
      stdio: "pipe",
      encoding: "utf8",
      timeout: 240000,
    },
  );

  return getDependencyAwareTestPlan();
}

export function getDependencyAwareTestPlan(): DependencyAwareTestPlan {
  if (!fs.existsSync(output)) {
    return refreshDependencyAwareTestPlan();
  }

  return JSON.parse(
    fs.readFileSync(output, "utf8"),
  ) as DependencyAwareTestPlan;
}
