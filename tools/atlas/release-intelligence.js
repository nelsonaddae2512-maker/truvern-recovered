#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, "tools", "atlas", "output");
const snapshotDir = path.join(repoRoot, "tools", "atlas", "snapshots");
const graphPath = path.join(outputDir, "explorer-graph.json");
const latestDiffPath = path.join(outputDir, "release-diff.json");
const latestReportPath = path.join(outputDir, "release-readiness.md");

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function normalizeName(value) {
  return String(value || "snapshot")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "snapshot";
}

function hash(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function nodeSignature(node) {
  return hash({
    id: node.id,
    key: node.key,
    type: node.type,
    label: node.label,
    metadata: node.metadata || {},
    features: [...(node.features || [])].sort(),
    impact: node.impact || null,
  });
}

function edgeKey(edge) {
  return `${edge.source}::${edge.type || "depends_on"}::${edge.target}`;
}

function cycleKey(cycle) {
  return [...cycle].sort().join("::");
}

function snapshotGraph(name) {
  if (!fs.existsSync(graphPath)) {
    throw new Error(`ATLAS graph not found: ${graphPath}`);
  }

  ensureDirectory(snapshotDir);

  const graph = readJson(graphPath);
  const now = new Date();
  const safeName = normalizeName(name || now.toISOString().replace(/[:.]/g, "-"));
  const fileName = `${now.toISOString().replace(/[:.]/g, "-")}__${safeName}.json`;
  const filePath = path.join(snapshotDir, fileName);

  const snapshot = {
    schemaVersion: 1,
    name: safeName,
    createdAt: now.toISOString(),
    graphHash: hash(graph),
    summary: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      cycles: graph.overlays?.cycles?.length || 0,
      featureCoupling: graph.overlays?.featureCoupling?.length || 0,
    },
    graph,
  };

  writeJson(filePath, snapshot);
  fs.writeFileSync(path.join(snapshotDir, "latest.txt"), fileName + "\n", "utf8");

  return { filePath, snapshot };
}

function listSnapshots() {
  ensureDirectory(snapshotDir);

  return fs
    .readdirSync(snapshotDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse()
    .map((file) => {
      const fullPath = path.join(snapshotDir, file);
      const snapshot = readJson(fullPath);

      return {
        file,
        name: snapshot.name,
        createdAt: snapshot.createdAt,
        graphHash: snapshot.graphHash,
        summary: snapshot.summary,
      };
    });
}

function resolveBaseline(requested) {
  ensureDirectory(snapshotDir);

  if (requested) {
    const direct = path.isAbsolute(requested)
      ? requested
      : path.join(snapshotDir, requested);

    if (!fs.existsSync(direct)) {
      throw new Error(`Baseline snapshot not found: ${direct}`);
    }

    return direct;
  }

  const snapshots = listSnapshots();
  if (!snapshots.length) {
    throw new Error("No ATLAS release snapshots are available.");
  }

  return path.join(snapshotDir, snapshots[0].file);
}

function compareGraphs(baselineSnapshot, currentGraph) {
  const baselineGraph = baselineSnapshot.graph;
  const baselineNodes = new Map(baselineGraph.nodes.map((node) => [node.id, node]));
  const currentNodes = new Map(currentGraph.nodes.map((node) => [node.id, node]));

  const addedNodes = [];
  const removedNodes = [];
  const changedNodes = [];

  for (const [id, node] of currentNodes) {
    if (!baselineNodes.has(id)) {
      addedNodes.push(node);
      continue;
    }

    const prior = baselineNodes.get(id);
    if (nodeSignature(prior) !== nodeSignature(node)) {
      changedNodes.push({
        id,
        before: prior,
        after: node,
        impactDelta:
          Number(node.impact?.score || 0) - Number(prior.impact?.score || 0),
      });
    }
  }

  for (const [id, node] of baselineNodes) {
    if (!currentNodes.has(id)) {
      removedNodes.push(node);
    }
  }

  const baselineEdges = new Map(
    baselineGraph.edges.map((edge) => [edgeKey(edge), edge]),
  );
  const currentEdges = new Map(
    currentGraph.edges.map((edge) => [edgeKey(edge), edge]),
  );

  const addedEdges = [...currentEdges]
    .filter(([key]) => !baselineEdges.has(key))
    .map(([, edge]) => edge);
  const removedEdges = [...baselineEdges]
    .filter(([key]) => !currentEdges.has(key))
    .map(([, edge]) => edge);

  const baselineCycles = new Map(
    (baselineGraph.overlays?.cycles || []).map((cycle) => [cycleKey(cycle), cycle]),
  );
  const currentCycles = new Map(
    (currentGraph.overlays?.cycles || []).map((cycle) => [cycleKey(cycle), cycle]),
  );

  const newCycles = [...currentCycles]
    .filter(([key]) => !baselineCycles.has(key))
    .map(([, cycle]) => cycle);
  const resolvedCycles = [...baselineCycles]
    .filter(([key]) => !currentCycles.has(key))
    .map(([, cycle]) => cycle);

  const affectedFeatures = [
    ...new Set([
      ...addedNodes.flatMap((node) => node.features || []),
      ...removedNodes.flatMap((node) => node.features || []),
      ...changedNodes.flatMap((entry) => [
        ...(entry.before.features || []),
        ...(entry.after.features || []),
      ]),
    ]),
  ].sort();

  const highImpactChanges = [
    ...addedNodes,
    ...changedNodes.map((entry) => entry.after),
    ...removedNodes,
  ]
    .filter((node) => Number(node.impact?.score || 0) >= 50)
    .sort(
      (a, b) =>
        Number(b.impact?.score || 0) - Number(a.impact?.score || 0),
    );

  let riskScore = 0;
  riskScore += addedNodes.length * 1;
  riskScore += removedNodes.length * 3;
  riskScore += changedNodes.length * 2;
  riskScore += addedEdges.length * 0.5;
  riskScore += removedEdges.length * 1;
  riskScore += newCycles.length * 8;
  riskScore -= resolvedCycles.length * 2;
  riskScore += highImpactChanges.length * 5;
  riskScore = Math.max(0, Math.round(riskScore));

  const readiness =
    riskScore >= 80
      ? "BLOCKED"
      : riskScore >= 40
        ? "REVIEW_REQUIRED"
        : riskScore >= 15
          ? "CAUTION"
          : "READY";

  const checklist = [];

  if (removedNodes.length) {
    checklist.push("Verify that removed architecture assets have no runtime callers.");
  }
  if (removedEdges.length) {
    checklist.push("Validate removed dependency paths and related fallback behavior.");
  }
  if (newCycles.length) {
    checklist.push("Resolve or formally accept every newly introduced dependency cycle.");
  }
  if (highImpactChanges.length) {
    checklist.push("Run regression tests for every high-impact changed architecture asset.");
  }
  if (affectedFeatures.length) {
    checklist.push("Complete feature-level validation for all affected features.");
  }
  if (!checklist.length) {
    checklist.push("Confirm smoke tests and deployment checks before release.");
  }

  return {
    generatedAt: new Date().toISOString(),
    baseline: {
      name: baselineSnapshot.name,
      createdAt: baselineSnapshot.createdAt,
      graphHash: baselineSnapshot.graphHash,
      summary: baselineSnapshot.summary,
    },
    current: {
      graphHash: hash(currentGraph),
      summary: {
        nodes: currentGraph.nodes.length,
        edges: currentGraph.edges.length,
        cycles: currentGraph.overlays?.cycles?.length || 0,
        featureCoupling:
          currentGraph.overlays?.featureCoupling?.length || 0,
      },
    },
    readiness,
    riskScore,
    summary: {
      addedNodes: addedNodes.length,
      removedNodes: removedNodes.length,
      changedNodes: changedNodes.length,
      addedEdges: addedEdges.length,
      removedEdges: removedEdges.length,
      newCycles: newCycles.length,
      resolvedCycles: resolvedCycles.length,
      affectedFeatures: affectedFeatures.length,
      highImpactChanges: highImpactChanges.length,
    },
    addedNodes,
    removedNodes,
    changedNodes,
    addedEdges,
    removedEdges,
    newCycles,
    resolvedCycles,
    affectedFeatures,
    highImpactChanges,
    checklist,
  };
}

function createDiff(baselineFile) {
  const baselinePath = resolveBaseline(baselineFile);
  const baselineSnapshot = readJson(baselinePath);
  const currentGraph = readJson(graphPath);
  const result = compareGraphs(baselineSnapshot, currentGraph);

  writeJson(latestDiffPath, result);
  return result;
}

function markdownReport(diff) {
  const lines = [
    "# ATLAS Release Readiness Report",
    "",
    `Generated: ${diff.generatedAt}`,
    `Baseline: ${diff.baseline.name} (${diff.baseline.createdAt})`,
    `Readiness: **${diff.readiness}**`,
    `Risk score: **${diff.riskScore}**`,
    "",
    "## Change Summary",
    "",
    `- Added nodes: ${diff.summary.addedNodes}`,
    `- Removed nodes: ${diff.summary.removedNodes}`,
    `- Changed nodes: ${diff.summary.changedNodes}`,
    `- Added edges: ${diff.summary.addedEdges}`,
    `- Removed edges: ${diff.summary.removedEdges}`,
    `- New cycles: ${diff.summary.newCycles}`,
    `- Resolved cycles: ${diff.summary.resolvedCycles}`,
    `- Affected features: ${diff.summary.affectedFeatures}`,
    `- High-impact changes: ${diff.summary.highImpactChanges}`,
    "",
    "## Reviewer Checklist",
    "",
    ...diff.checklist.map((item) => `- [ ] ${item}`),
    "",
    "## Affected Features",
    "",
    ...(diff.affectedFeatures.length
      ? diff.affectedFeatures.map((feature) => `- ${feature}`)
      : ["- None detected"]),
    "",
    "## High-Impact Changes",
    "",
    ...(diff.highImpactChanges.length
      ? diff.highImpactChanges.map(
          (node) =>
            `- ${node.label} (${node.type}) — impact ${node.impact?.score || 0}`,
        )
      : ["- None detected"]),
    "",
  ];

  return lines.join("\n");
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function main() {
  const command = process.argv[2] || "help";

  if (command === "snapshot") {
    const result = snapshotGraph(argumentValue("--name"));
    console.log("ATLAS release snapshot created.");
    console.log(`File: ${result.filePath}`);
    console.log(`Nodes: ${result.snapshot.summary.nodes}`);
    console.log(`Edges: ${result.snapshot.summary.edges}`);
    return;
  }

  if (command === "diff") {
    const result = createDiff(argumentValue("--baseline"));
    console.log("ATLAS release diff complete.");
    console.log(`Readiness: ${result.readiness}`);
    console.log(`Risk score: ${result.riskScore}`);
    console.log(`Output: ${latestDiffPath}`);
    return;
  }

  if (command === "report") {
    const result = createDiff(argumentValue("--baseline"));
    fs.writeFileSync(latestReportPath, markdownReport(result) + "\n", "utf8");
    console.log("ATLAS release-readiness report complete.");
    console.log(`Readiness: ${result.readiness}`);
    console.log(`Risk score: ${result.riskScore}`);
    console.log(`Report: ${latestReportPath}`);
    return;
  }

  if (command === "list") {
    console.log(JSON.stringify(listSnapshots(), null, 2));
    return;
  }

  if (command === "self-test") {
    const graph = readJson(graphPath);
    const syntheticBaseline = {
      schemaVersion: 1,
      name: "self-test",
      createdAt: new Date().toISOString(),
      graphHash: hash(graph),
      summary: {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        cycles: graph.overlays?.cycles?.length || 0,
        featureCoupling:
          graph.overlays?.featureCoupling?.length || 0,
      },
      graph,
    };

    const result = compareGraphs(syntheticBaseline, graph);

    if (
      result.summary.addedNodes !== 0 ||
      result.summary.removedNodes !== 0 ||
      result.summary.changedNodes !== 0 ||
      result.readiness !== "READY"
    ) {
      throw new Error("ATLAS Release Intelligence self-test failed.");
    }

    console.log("ATLAS-04B Release Intelligence self-test passed.");
    return;
  }

  console.log("ATLAS-04B Release Intelligence");
  console.log("");
  console.log("Commands:");
  console.log('  snapshot --name "release-name"');
  console.log("  diff [--baseline snapshot-file.json]");
  console.log("  report [--baseline snapshot-file.json]");
  console.log("  list");
  console.log("  self-test");
}

module.exports = {
  compareGraphs,
  createDiff,
  listSnapshots,
  markdownReport,
  snapshotGraph,
};

if (require.main === module) {
  main();
}
