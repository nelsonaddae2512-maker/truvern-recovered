import "server-only";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type ExecutionState = {
  generatedAt: string;
  updatedAt: string;
  schemaVersion: 1;
  engineVersion: "ATLAS-09";
  baseline: Record<string, number | string>;
  currentMetrics: Record<string, number | string>;
  summary: {
    totalPatches: number;
    counts: Record<string, number>;
    validatedPatches: number;
    failedPatches: number;
    completedScoreGain: number;
    remainingEstimatedScoreGain: number;
  };
  patches: Array<{
    id: string;
    title: string;
    phase: number;
    phaseLabel: string;
    sourcePlanId: string;
    risk: string;
    affectedFiles: string[];
    estimatedHours: number;
    estimatedScoreGain: number;
    state: string;
    checkpointReference: string | null;
    reviewer: string | null;
    approver: string | null;
    implementer: string | null;
    validation: unknown;
    measuredImpact: {
      governanceScoreChange: number;
      rootCauseChange: number;
      dependencyCycleChange: number;
      detailedFindingChange: number;
    } | null;
    history: Array<Record<string, unknown>>;
  }>;
};

const root = process.cwd();
const statePath = path.join(root, "tools", "atlas", "output", "execution-state.json");
const enginePath = path.join(root, "tools", "atlas", "execution-orchestrator.js");

function run(args: string[], env?: Record<string, string>): void {
  execFileSync(process.execPath, [enginePath, ...args], {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
    timeout: 240000,
    env: { ...process.env, ...env },
  });
}

export function getExecutionState(): ExecutionState {
  if (!fs.existsSync(statePath)) run(["init"]);
  return JSON.parse(fs.readFileSync(statePath, "utf8")) as ExecutionState;
}

export function transitionExecution(
  patchId: string,
  target: string,
  actor?: string,
  note?: string,
  checkpointReference?: string,
): ExecutionState {
  run(
    ["transition", patchId, target, actor || "", note || ""],
    checkpointReference ? { ATLAS_CHECKPOINT: checkpointReference } : undefined,
  );
  return getExecutionState();
}

export function validateExecution(patchId: string, actor?: string): ExecutionState {
  run(["validate", patchId, actor || ""]);
  return getExecutionState();
}

export function rollbackExecution(patchId: string, actor?: string, note?: string): ExecutionState {
  run(["rollback", patchId, actor || "", note || ""]);
  return getExecutionState();
}

export function syncExecutionState(): ExecutionState {
  run(["sync"]);
  return getExecutionState();
}
