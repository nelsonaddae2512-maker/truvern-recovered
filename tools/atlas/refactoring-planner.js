#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const governancePath = path.join(root, "tools", "atlas", "output", "repository-governance.json");
const graphPath = path.join(root, "tools", "atlas", "output", "explorer-graph.json");
const rulesPath = path.join(root, "tools", "atlas", "refactoring-planner.rules.json");
const outputDir = path.join(root, "tools", "atlas", "output");
const jsonPath = path.join(outputDir, "refactoring-plan.json");
const markdownPath = path.join(outputDir, "refactoring-plan-report.md");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\.?\//, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function listRepositoryFiles(directory) {
  const ignored = new Set([".git", ".next", "node_modules", "coverage", "dist", "build", "Truvern-Backups"]);
  const files = [];

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else files.push(normalizePath(path.relative(directory, absolute)));
    }
  }

  walk(directory);
  return files;
}

function nodePath(node) {
  const metadata = node.metadata || {};
  const candidates = [metadata.file, metadata.path, metadata.filePath, metadata.source, node.id];
  return normalizePath(candidates.find((item) => typeof item === "string" && (item.includes("/") || item.includes("\\"))) || node.id || "");
}

function edgeTouches(edge, assetSet, nodeMap) {
  const source = nodeMap.get(edge.source);
  const target = nodeMap.get(edge.target);
  const sourcePath = source ? nodePath(source) : normalizePath(edge.source);
  const targetPath = target ? nodePath(target) : normalizePath(edge.target);
  return assetSet.has(sourcePath) || assetSet.has(targetPath);
}

function inferOwner(files, rules) {
  const mappings = rules.ownership?.mappings || [];
  const counts = new Map();

  for (const file of files) {
    for (const mapping of mappings) {
      if (file.startsWith(normalizePath(mapping.pathPrefix))) {
        counts.set(mapping.owner, (counts.get(mapping.owner) || 0) + 1);
      }
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || rules.ownership?.fallback || "Engineering";
}

function inferTests(files, allFiles, rules) {
  const markers = rules.testInference?.markers || [];
  const testFiles = allFiles.filter((file) => markers.some((marker) => file.includes(marker)));
  const stems = unique(
    files.map((file) => path.posix.basename(file).replace(/\.[^.]+$/, "").replace(/\.client$|\.server$/, ""))
  );

  const matched = testFiles.filter((file) =>
    stems.some((stem) => stem.length >= 4 && file.toLowerCase().includes(stem.toLowerCase()))
  );

  const commands = rules.testInference?.preferredCommands || [];
  return {
    files: matched.slice(0, rules.limits?.maximumTestsPerPlan || 12),
    commands,
    missingFocusedCoverage: matched.length === 0,
  };
}

function estimateRisk(cause, files, edgeCount, graph, rules) {
  const impacts = new Map(
    (graph.nodes || []).map((node) => [nodePath(node), Number(node.impact?.score || 0)])
  );
  const maxImpact = files.reduce((max, file) => Math.max(max, impacts.get(file) || 0), 0);
  const config = rules.risk || {};

  let score = 0;
  if (maxImpact >= Number(config.highImpactScore || 90)) score += 3;
  else if (maxImpact >= Number(config.mediumImpactScore || 70)) score += 2;
  else if (maxImpact > 0) score += 1;

  if (files.length >= Number(config.highFileCount || 16)) score += 3;
  else if (files.length >= Number(config.mediumFileCount || 7)) score += 2;
  else score += 1;

  if (edgeCount >= Number(config.highEdgeCount || 35)) score += 3;
  else if (edgeCount >= Number(config.mediumEdgeCount || 15)) score += 2;
  else score += 1;

  if (cause.severity === "CRITICAL") score += 3;
  else if (cause.severity === "HIGH") score += 2;
  else if (cause.severity === "MEDIUM") score += 1;

  const level = score >= 9 ? "HIGH" : score >= 6 ? "MEDIUM" : "LOW";
  return { level, score, maxImpact };
}

function estimateEffort(cause, files, edgeCount, rules) {
  const config = rules.effort || {};
  let minutes =
    files.length * Number(config.minutesPerFile || 18) +
    edgeCount * Number(config.minutesPerDependencyEdge || 4);

  if (cause.ruleId === "DEPENDENCY-CYCLE") {
    minutes += Number(cause.occurrenceCount || 1) * Number(config.minutesPerCycleOccurrence || 12);
  }

  minutes = Math.max(Number(config.minimumMinutes || 30), minutes);
  minutes = Math.min(Number(config.maximumMinutes || 960), minutes);

  const rounded = Math.ceil(minutes / 15) * 15;
  return {
    minutes: rounded,
    hours: Number((rounded / 60).toFixed(1)),
    label:
      rounded <= 60 ? "Small" :
      rounded <= 240 ? "Medium" :
      rounded <= 480 ? "Large" :
      "Extra large",
  };
}

function buildSteps(cause, files, tests, rules) {
  const limit = Number(rules.limits?.maximumStepsPerPlan || 10);
  const steps = [];

  steps.push({
    order: steps.length + 1,
    title: "Confirm the architecture boundary",
    description: `Review ${cause.ruleId} in ${cause.ownershipArea} and confirm the intended dependency direction.`,
    validation: "The target boundary and permitted dependency direction are documented.",
  });

  if (cause.ruleId === "DEPENDENCY-CYCLE") {
    steps.push({
      order: steps.length + 1,
      title: "Select the cycle break point",
      description: `Use ${cause.centralAsset || files[0] || cause.ownershipArea} as the first candidate for dependency inversion.`,
      validation: "One stable interface or domain service owns the shared contract.",
    });
    steps.push({
      order: steps.length + 1,
      title: "Extract the shared contract",
      description: "Move shared types and interfaces into a dependency-neutral module.",
      validation: "Both sides import the contract without importing each other.",
    });
  } else if (cause.ruleId.includes("CLIENT-TO-")) {
    steps.push({
      order: steps.length + 1,
      title: "Introduce a server boundary",
      description: "Move database or server-only access behind a route handler, server action, or domain service.",
      validation: "Client modules no longer import server-only or Prisma modules.",
    });
  } else if (cause.ruleId === "HIGH-IMPACT-HOTSPOT") {
    steps.push({
      order: steps.length + 1,
      title: "Split the hotspot by responsibility",
      description: "Separate orchestration, data access, presentation, and policy logic into focused modules.",
      validation: "The central module has fewer responsibilities and a smaller dependency fan-out.",
    });
  } else {
    steps.push({
      order: steps.length + 1,
      title: "Apply the governed structure",
      description: cause.remediation,
      validation: "The affected assets comply with the governance rule.",
    });
  }

  steps.push({
    order: steps.length + 1,
    title: "Update dependent imports",
    description: `Modify the affected dependency surface across ${files.length} identified file(s).`,
    validation: "No obsolete imports or unresolved references remain.",
  });

  steps.push({
    order: steps.length + 1,
    title: "Add focused regression coverage",
    description: tests.missingFocusedCoverage
      ? "Create targeted tests around the changed boundary and its highest-impact workflows."
      : `Run and extend ${tests.files.length} related test file(s).`,
    validation: "Critical behavior is covered before the architecture change is released.",
  });

  for (const command of tests.commands) {
    steps.push({
      order: steps.length + 1,
      title: `Validate with ${command}`,
      description: `Run \`${command}\` after the refactor.`,
      validation: "The command completes successfully.",
    });
  }

  return steps.slice(0, limit).map((step, index) => ({ ...step, order: index + 1 }));
}

function rollbackSteps(cause, rules) {
  const steps = [
    "Create a repository checkpoint before changing files.",
    "Keep the extracted contract or service isolated in a dedicated commit.",
    "Revert import rewrites independently if TypeScript validation fails.",
    "Restore the previous module boundary from the checkpoint if runtime regression is detected.",
    "Regenerate the ATLAS graph and governance report after rollback.",
    "Document the failed assumption before attempting a different break point.",
  ];
  return steps.slice(0, Number(rules.limits?.maximumRollbackSteps || 6));
}

function collectAffectedFiles(cause, graph, rules) {
  const maxFiles = Number(rules.limits?.maximumFilesPerPlan || 40);
  const direct = unique([
    ...(cause.assets || []),
    ...(cause.evidence || []).filter((item) => String(item).includes("/")),
    cause.centralAsset,
  ].map(normalizePath));

  const nodeMap = new Map((graph.nodes || []).map((node) => [node.id, node]));
  const directSet = new Set(direct);
  const adjacent = [];

  for (const edge of graph.edges || []) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    const sourcePath = source ? nodePath(source) : normalizePath(edge.source);
    const targetPath = target ? nodePath(target) : normalizePath(edge.target);

    if (directSet.has(sourcePath)) adjacent.push(targetPath);
    if (directSet.has(targetPath)) adjacent.push(sourcePath);
  }

  return unique([...direct, ...adjacent]).filter(Boolean).slice(0, maxFiles);
}

function buildPlan(governance, graph, rules, allFiles) {
  const nodeMap = new Map((graph.nodes || []).map((node) => [node.id, node]));
  const causes = (governance.rootCauses || []).slice(0, Number(rules.limits?.maximumPlans || 12));

  const plans = causes.map((cause, index) => {
    const files = collectAffectedFiles(cause, graph, rules);
    const assetSet = new Set(files);
    const edgeCount = (graph.edges || []).filter((edge) => edgeTouches(edge, assetSet, nodeMap)).length;
    const tests = inferTests(files, allFiles, rules);
    const effort = estimateEffort(cause, files, edgeCount, rules);
    const risk = estimateRisk(cause, files, edgeCount, graph, rules);
    const owner = inferOwner(files, rules);
    const steps = buildSteps(cause, files, tests, rules);

    return {
      id: `REF-${String(index + 1).padStart(3, "0")}`,
      priority: index + 1,
      title: `${cause.title} — ${cause.ownershipArea}`,
      rootCauseId: cause.id,
      ruleId: cause.ruleId,
      category: cause.category,
      severity: cause.severity,
      ownershipArea: cause.ownershipArea,
      recommendedOwner: owner,
      centralAsset: cause.centralAsset,
      affectedFiles: files,
      affectedFileCount: files.length,
      affectedEdgeCount: edgeCount,
      affectedOccurrences: cause.occurrenceCount,
      regressionRisk: risk,
      effort,
      tests,
      steps,
      rollback: rollbackSteps(cause, rules),
      estimatedScoreGain: Number(cause.estimatedScoreGain || 0),
      projectedRepositoryScore: Math.min(100, Math.round(governance.score + Number(cause.estimatedScoreGain || 0))),
      releaseImpact:
        risk.level === "HIGH"
          ? "Requires a dedicated release checkpoint and focused regression pass."
          : risk.level === "MEDIUM"
            ? "Suitable for an isolated release candidate with targeted validation."
            : "Suitable for a normal engineering change with standard validation.",
    };
  });

  const totalMinutes = plans.reduce((sum, plan) => sum + plan.effort.minutes, 0);
  const totalGain = plans.reduce((sum, plan) => sum + plan.estimatedScoreGain, 0);

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    engineVersion: "ATLAS-07",
    sourceGovernanceEngine: governance.engineVersion,
    repositoryScore: governance.score,
    repositoryStatus: governance.status,
    summary: {
      rootCausesAvailable: governance.rootCauses?.length || 0,
      plansGenerated: plans.length,
      totalAffectedFiles: unique(plans.flatMap((plan) => plan.affectedFiles)).length,
      totalEstimatedHours: Number((totalMinutes / 60).toFixed(1)),
      potentialScoreGain: Number(totalGain.toFixed(1)),
      projectedMaximumScore: Math.min(100, Math.round(governance.score + totalGain)),
      highRiskPlans: plans.filter((plan) => plan.regressionRisk.level === "HIGH").length,
      mediumRiskPlans: plans.filter((plan) => plan.regressionRisk.level === "MEDIUM").length,
      lowRiskPlans: plans.filter((plan) => plan.regressionRisk.level === "LOW").length,
    },
    executionOrder: plans.map((plan) => plan.id),
    plans,
  };
}

function markdown(result) {
  const lines = [
    "# ATLAS Intelligent Refactoring Planner",
    "",
    `Generated: ${result.generatedAt}`,
    `Engine: ${result.engineVersion}`,
    `Repository score: **${result.repositoryScore}/100**`,
    `Repository status: **${result.repositoryStatus}**`,
    "",
    "## Portfolio",
    "",
    `- Plans generated: ${result.summary.plansGenerated}`,
    `- Unique affected files: ${result.summary.totalAffectedFiles}`,
    `- Estimated effort: ${result.summary.totalEstimatedHours} hours`,
    `- Potential score gain: +${result.summary.potentialScoreGain}`,
    `- Projected maximum score: ${result.summary.projectedMaximumScore}/100`,
    "",
    "## Execution Order",
    "",
  ];

  for (const plan of result.plans) {
    lines.push(
      `### ${plan.priority}. ${plan.title}`,
      "",
      `- Plan: ${plan.id}`,
      `- Owner: ${plan.recommendedOwner}`,
      `- Risk: ${plan.regressionRisk.level}`,
      `- Effort: ${plan.effort.hours} hours (${plan.effort.label})`,
      `- Files: ${plan.affectedFileCount}`,
      `- Dependency edges: ${plan.affectedEdgeCount}`,
      `- Estimated score gain: +${plan.estimatedScoreGain}`,
      "",
      "Steps:",
      ...plan.steps.map((step) => `${step.order}. ${step.title} — ${step.description}`),
      ""
    );
  }

  return lines.join("\n");
}

function analyze() {
  const governance = readJson(governancePath);
  if (governance.engineVersion !== "ATLAS-06B.2") {
    throw new Error("ATLAS-07 requires ATLAS-06B.2 governance output.");
  }
  return buildPlan(governance, readJson(graphPath), readJson(rulesPath), listRepositoryFiles(root));
}

function write(result) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  fs.writeFileSync(markdownPath, markdown(result) + "\n", "utf8");
}

function main() {
  const command = process.argv[2] || "help";

  if (command === "analyze") {
    const result = analyze();
    write(result);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "report") {
    const result = analyze();
    write(result);
    console.log("ATLAS-07 Intelligent Refactoring Planner complete.");
    console.log(`Plans generated: ${result.summary.plansGenerated}`);
    console.log(`Unique affected files: ${result.summary.totalAffectedFiles}`);
    console.log(`Estimated effort: ${result.summary.totalEstimatedHours} hours`);
    console.log(`Potential score gain: +${result.summary.potentialScoreGain}`);
    console.log(`Projected maximum score: ${result.summary.projectedMaximumScore}/100`);
    console.log(`JSON: ${jsonPath}`);
    console.log(`Report: ${markdownPath}`);
    return;
  }

  if (command === "self-test") {
    const governance = {
      engineVersion: "ATLAS-06B.2",
      score: 75,
      status: "ATTENTION",
      rootCauses: [
        {
          id: "ARCHITECTURE_DRIFT|DEPENDENCY-CYCLE|components/review/a.client.tsx",
          title: "Connected dependency-cycle cluster",
          ruleId: "DEPENDENCY-CYCLE",
          category: "ARCHITECTURE_DRIFT",
          severity: "MEDIUM",
          ownershipArea: "components/review",
          centralAsset: "components/review/a.client.tsx",
          assets: ["components/review/a.client.tsx", "lib/review/service.ts"],
          evidence: ["components/review/a.client.tsx", "lib/review/service.ts"],
          occurrenceCount: 4,
          estimatedScoreGain: 4.2,
          remediation: "Break the shared cycle cluster.",
        },
      ],
    };
    const graph = {
      nodes: [
        { id: "components/review/a.client.tsx", metadata: { file: "components/review/a.client.tsx" }, impact: { score: 94 } },
        { id: "lib/review/service.ts", metadata: { file: "lib/review/service.ts" }, impact: { score: 70 } },
        { id: "lib/review/types.ts", metadata: { file: "lib/review/types.ts" }, impact: { score: 30 } },
      ],
      edges: [
        { source: "components/review/a.client.tsx", target: "lib/review/service.ts" },
        { source: "lib/review/service.ts", target: "lib/review/types.ts" },
      ],
    };
    const result = buildPlan(
      governance,
      graph,
      readJson(rulesPath),
      ["components/review/a.client.tsx", "lib/review/service.ts", "lib/review/types.ts", "components/review/a.test.tsx"],
    );

    const plan = result.plans[0];
    if (!plan) throw new Error("Self-test failed: no plan generated.");
    if (plan.affectedFileCount < 2) throw new Error("Self-test failed: affected files missing.");
    if (!plan.steps.some((step) => step.title.includes("cycle break"))) throw new Error("Self-test failed: cycle-specific plan missing.");
    if (!plan.rollback.length) throw new Error("Self-test failed: rollback strategy missing.");
    if (!plan.effort.minutes) throw new Error("Self-test failed: effort estimate missing.");

    console.log("ATLAS-07 Intelligent Refactoring Planner self-test passed.");
    console.log(`Plans: ${result.summary.plansGenerated}`);
    console.log(`Affected files: ${result.summary.totalAffectedFiles}`);
    console.log(`Effort: ${result.summary.totalEstimatedHours} hours`);
    console.log(`Risk: ${plan.regressionRisk.level}`);
    return;
  }

  console.log("ATLAS-07 Intelligent Refactoring Planner");
  console.log("Commands: analyze | report | self-test");
}

module.exports = { analyze, buildPlan, markdown };
if (require.main === module) main();
