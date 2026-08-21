#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const root = process.cwd();
const rulesPath = path.join(root, "tools", "atlas", "execution-orchestrator.rules.json");
const patchPlanPath = path.join(root, "tools", "atlas", "output", "patch-plan.json");
const governancePath = path.join(root, "tools", "atlas", "output", "repository-governance.json");
const graphPath = path.join(root, "tools", "atlas", "output", "explorer-graph.json");
const statePath = path.join(root, "tools", "atlas", "output", "execution-state.json");
const reportPath = path.join(root, "tools", "atlas", "output", "execution-state-report.md");
const historyPath = path.join(root, "tools", "atlas", "output", "execution-history.ndjson");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const now = () => new Date().toISOString();

function safeRead(file, fallback = null) {
  try { return readJson(file); } catch { return fallback; }
}

function snapshotMetrics() {
  const governance = safeRead(governancePath, {});
  const graph = safeRead(graphPath, {});
  return {
    capturedAt: now(),
    governanceScore: Number(governance.score ?? governance.summary?.score ?? 0),
    governanceStatus: governance.status ?? governance.summary?.status ?? "UNKNOWN",
    rawOccurrences: Number(governance.rawOccurrences ?? governance.summary?.rawOccurrences ?? 0),
    detailedFindings: Number(governance.detailedFindings ?? governance.summary?.detailedFindings ?? 0),
    rootCauses: Number(governance.architecturalRootCauses ?? governance.summary?.architecturalRootCauses ?? 0),
    graphNodes: Number(graph.nodes?.length ?? graph.summary?.nodes ?? 0),
    graphEdges: Number(graph.edges?.length ?? graph.summary?.edges ?? 0),
    dependencyCycles: Number(graph.cycles?.length ?? graph.summary?.cycles ?? 0),
    featureCouplingPairs: Number(graph.featureCouplingPairs?.length ?? graph.summary?.featureCouplingPairs ?? 0)
  };
}

function event(type, patchId, details = {}) {
  return { at: now(), type, patchId, ...details };
}

function initialState() {
  const patchPlan = readJson(patchPlanPath);
  const baseline = snapshotMetrics();
  return {
    generatedAt: now(),
    updatedAt: now(),
    schemaVersion: 1,
    engineVersion: "ATLAS-09",
    baseline,
    currentMetrics: baseline,
    summary: {},
    patches: patchPlan.patches.map((patch) => ({
      id: patch.id,
      title: patch.title,
      phase: patch.phase,
      phaseLabel: patch.phaseLabel,
      sourcePlanId: patch.sourcePlanId,
      risk: patch.risk,
      affectedFiles: patch.affectedFiles,
      estimatedHours: patch.estimatedHours,
      estimatedScoreGain: patch.estimatedScoreGain,
      state: "PROPOSED",
      checkpointReference: null,
      reviewer: null,
      approver: null,
      implementer: null,
      validation: null,
      metricsBefore: null,
      metricsAfter: null,
      measuredImpact: null,
      history: [event("CREATED", patch.id)]
    }))
  };
}

function summarize(state) {
  const counts = {};
  for (const patch of state.patches) counts[patch.state] = (counts[patch.state] || 0) + 1;
  const validated = state.patches.filter((p) => p.state === "VALIDATED");
  const failed = state.patches.filter((p) => p.state === "FAILED");
  return {
    totalPatches: state.patches.length,
    counts,
    validatedPatches: validated.length,
    failedPatches: failed.length,
    completedScoreGain: Number(validated.reduce((s, p) => s + Number(p.measuredImpact?.governanceScoreChange || 0), 0).toFixed(1)),
    remainingEstimatedScoreGain: Number(
      state.patches.filter((p) => !["VALIDATED", "ROLLED_BACK"].includes(p.state))
        .reduce((s, p) => s + Number(p.estimatedScoreGain || 0), 0).toFixed(1)
    )
  };
}

function writeState(state) {
  state.updatedAt = now();
  state.summary = summarize(state);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
  fs.writeFileSync(reportPath, markdown(state) + "\n", "utf8");
}

function loadState() {
  if (!fs.existsSync(statePath)) {
    const state = initialState();
    writeState(state);
    return state;
  }
  return readJson(statePath);
}

function appendHistory(entry) {
  fs.appendFileSync(historyPath, JSON.stringify(entry) + "\n", "utf8");
}

function getPatch(state, patchId) {
  const patch = state.patches.find((item) => item.id === patchId);
  if (!patch) throw new Error(`Unknown patch: ${patchId}`);
  return patch;
}

function transition(patchId, target, actor, note, checkpointReference) {
  const rules = readJson(rulesPath);
  const state = loadState();
  const patch = getPatch(state, patchId);
  const allowed = rules.workflow.allowedTransitions[patch.state] || [];
  if (!allowed.includes(target)) {
    throw new Error(`Transition ${patch.state} -> ${target} is not allowed.`);
  }

  if (target === "APPROVED" && !actor) throw new Error("Approval requires an approver.");
  if (target === "IMPLEMENTED" && !checkpointReference) {
    throw new Error("Implementation requires a checkpoint reference.");
  }

  if (target === "IN_REVIEW") patch.reviewer = actor || patch.reviewer;
  if (target === "APPROVED") patch.approver = actor;
  if (target === "IMPLEMENTED") {
    patch.implementer = actor || patch.implementer;
    patch.checkpointReference = checkpointReference;
    patch.metricsBefore = snapshotMetrics();
  }

  const previous = patch.state;
  patch.state = target;
  const entry = event("TRANSITION", patch.id, { previous, target, actor: actor || null, note: note || null });
  patch.history.push(entry);
  appendHistory(entry);
  writeState(state);
  return state;
}

function executeCommand(command, timeoutSeconds) {
  const startedAt = now();
  try {
    const output = cp.execSync(command, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutSeconds * 1000,
      windowsHide: true
    });
    return { command, status: "PASSED", startedAt, completedAt: now(), output: output.slice(-8000) };
  } catch (error) {
    return {
      command,
      status: "FAILED",
      startedAt,
      completedAt: now(),
      output: String(error.stdout || error.message || "").slice(-8000),
      error: String(error.stderr || error.message || "").slice(-8000)
    };
  }
}

function validate(patchId, actor) {
  const rules = readJson(rulesPath);
  let state = loadState();
  const patch = getPatch(state, patchId);
  if (patch.state !== "IMPLEMENTED" && patch.state !== "FAILED") {
    throw new Error("Validation requires IMPLEMENTED or FAILED state.");
  }

  if (patch.state === "FAILED") {
    patch.state = "IMPLEMENTED";
    patch.history.push(event("RETRY_VALIDATION", patch.id, { actor: actor || null }));
  }

  patch.state = "VALIDATING";
  patch.history.push(event("VALIDATION_STARTED", patch.id, { actor: actor || null }));
  writeState(state);

  const results = [];
  for (const command of rules.validation.commands || []) {
    const result = executeCommand(command, Number(rules.validation.timeoutSeconds || 180));
    results.push(result);
    if (result.status === "FAILED") break;
  }

  state = loadState();
  const current = getPatch(state, patchId);
  const passed = results.every((result) => result.status === "PASSED");
  current.validation = {
    startedAt: results[0]?.startedAt || now(),
    completedAt: now(),
    actor: actor || null,
    status: passed ? "PASSED" : "FAILED",
    results
  };
  current.metricsAfter = snapshotMetrics();

  const before = current.metricsBefore || state.baseline;
  const after = current.metricsAfter;
  current.measuredImpact = {
    governanceScoreChange: Number((after.governanceScore - before.governanceScore).toFixed(1)),
    rootCauseChange: after.rootCauses - before.rootCauses,
    dependencyCycleChange: after.dependencyCycles - before.dependencyCycles,
    detailedFindingChange: after.detailedFindings - before.detailedFindings
  };

  current.state = passed ? "VALIDATED" : "FAILED";
  const entry = event(passed ? "VALIDATION_PASSED" : "VALIDATION_FAILED", current.id, {
    actor: actor || null,
    measuredImpact: current.measuredImpact
  });
  current.history.push(entry);
  appendHistory(entry);
  state.currentMetrics = after;
  writeState(state);
  return state;
}

function rollback(patchId, actor, note) {
  const state = loadState();
  const patch = getPatch(state, patchId);
  if (!["IMPLEMENTED", "FAILED"].includes(patch.state)) {
    throw new Error("Rollback is allowed only after implementation or failed validation.");
  }
  patch.state = "ROLLED_BACK";
  const entry = event("ROLLED_BACK", patch.id, { actor: actor || null, note: note || null });
  patch.history.push(entry);
  appendHistory(entry);
  writeState(state);
  return state;
}

function sync() {
  const previous = fs.existsSync(statePath) ? readJson(statePath) : null;
  const next = initialState();

  if (previous) {
    const byId = new Map(previous.patches.map((p) => [p.id, p]));
    next.patches = next.patches.map((patch) => byId.get(patch.id) || patch);
    next.baseline = previous.baseline || next.baseline;
    next.currentMetrics = previous.currentMetrics || next.currentMetrics;
  }

  writeState(next);
  return next;
}

function markdown(state) {
  const lines = [
    "# ATLAS Execution and Validation Orchestrator", "",
    `Updated: ${state.updatedAt}`,
    `Engine: ${state.engineVersion}`, "",
    "## Summary", "",
    `- Total patches: ${state.summary.totalPatches}`,
    `- Validated: ${state.summary.validatedPatches}`,
    `- Failed: ${state.summary.failedPatches}`,
    `- Measured score gain: ${state.summary.completedScoreGain}`,
    `- Remaining estimated score gain: ${state.summary.remainingEstimatedScoreGain}`, "",
    "## Patch Status", ""
  ];

  for (const patch of state.patches) {
    lines.push(
      `### ${patch.id} — ${patch.title}`, "",
      `- State: ${patch.state}`,
      `- Phase: ${patch.phase} — ${patch.phaseLabel}`,
      `- Risk: ${patch.risk}`,
      `- Approver: ${patch.approver || "Not recorded"}`,
      `- Implementer: ${patch.implementer || "Not recorded"}`,
      `- Checkpoint: ${patch.checkpointReference || "Not recorded"}`,
      `- Measured governance score change: ${patch.measuredImpact?.governanceScoreChange ?? "Not measured"}`, ""
    );
  }
  return lines.join("\n");
}

function printSummary(state) {
  console.log("ATLAS-09 Execution and Validation Orchestrator complete.");
  console.log(`Patches tracked: ${state.summary.totalPatches}`);
  console.log(`Validated: ${state.summary.validatedPatches}`);
  console.log(`Failed: ${state.summary.failedPatches}`);
  console.log(`Measured score gain: ${state.summary.completedScoreGain}`);
  console.log(`Remaining estimated score gain: ${state.summary.remainingEstimatedScoreGain}`);
  console.log(`State: ${statePath}`);
  console.log(`Report: ${reportPath}`);
}

function main() {
  const [command = "help", patchId, target, actor, ...rest] = process.argv.slice(2);
  const note = rest.join(" ") || null;

  if (command === "init" || command === "sync" || command === "report") {
    const state = command === "sync" ? sync() : loadState();
    writeState(state);
    printSummary(state);
    return;
  }

  if (command === "transition") {
    if (!patchId || !target) throw new Error("Usage: transition PATCH-001 TARGET [actor] [note]");
    const checkpoint = process.env.ATLAS_CHECKPOINT || null;
    printSummary(transition(patchId, target, actor || null, note, checkpoint));
    return;
  }

  if (command === "validate") {
    if (!patchId) throw new Error("Usage: validate PATCH-001 [actor]");
    printSummary(validate(patchId, target || null));
    return;
  }

  if (command === "rollback") {
    if (!patchId) throw new Error("Usage: rollback PATCH-001 [actor] [note]");
    printSummary(rollback(patchId, target || null, [actor, ...rest].filter(Boolean).join(" ") || null));
    return;
  }

  if (command === "self-test") {
    const rules = readJson(rulesPath);
    const allowed = rules.workflow.allowedTransitions;
    if (!allowed.PROPOSED.includes("IN_REVIEW")) throw new Error("Self-test failed: review transition missing.");
    if (!allowed.APPROVED.includes("IMPLEMENTED")) throw new Error("Self-test failed: implementation transition missing.");
    if (rules.safety.neverModifyApplicationCode !== true) throw new Error("Self-test failed: unsafe configuration.");
    console.log("ATLAS-09 Execution and Validation Orchestrator self-test passed.");
    console.log(`States: ${rules.workflow.states.length}`);
    console.log(`Validation commands: ${rules.validation.commands.length}`);
    console.log("Application code modification: DISABLED");
    return;
  }

  console.log("ATLAS-09 Execution and Validation Orchestrator");
  console.log("Commands:");
  console.log("  init");
  console.log("  sync");
  console.log("  report");
  console.log("  transition PATCH-001 IN_REVIEW reviewer");
  console.log("  transition PATCH-001 APPROVED approver");
  console.log("  ATLAS_CHECKPOINT=<path> transition PATCH-001 IMPLEMENTED implementer");
  console.log("  validate PATCH-001 actor");
  console.log("  rollback PATCH-001 actor note");
  console.log("  self-test");
}

module.exports = { loadState, sync, transition, validate, rollback, snapshotMetrics };
if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
