#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const graphPath = path.join(
  repoRoot,
  "tools",
  "atlas",
  "output",
  "explorer-graph.json",
);

function readGraph() {
  if (!fs.existsSync(graphPath)) {
    throw new Error(`ATLAS graph not found: ${graphPath}`);
  }

  return JSON.parse(fs.readFileSync(graphPath, "utf8"));
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value) {
  return [...new Set(normalize(value).split(/\s+/).filter((token) => token.length > 2))];
}

function nodeText(node) {
  return normalize(
    [
      node.id,
      node.key,
      node.label,
      node.type,
      ...(node.features || []),
      JSON.stringify(node.metadata || {}),
    ].join(" "),
  );
}

function scoreNode(node, tokens) {
  const text = nodeText(node);
  let score = 0;

  for (const token of tokens) {
    if (text.includes(token)) score += 8;
    if (normalize(node.label).includes(token)) score += 10;
    if ((node.features || []).some((feature) => normalize(feature).includes(token))) {
      score += 12;
    }
  }

  score += Math.min(20, Number(node.impact?.score || 0) / 5);
  return score;
}

function inferLayer(node) {
  const value = `${node.type} ${node.id}`.toLowerCase();

  if (value.includes("prisma") || value.includes("model")) return "Data";
  if (value.includes("api") || value.includes("route")) return "API";
  if (value.includes("component")) return "UI";
  if (value.includes("page")) return "Page";
  if (value.includes("lib") || value.includes("service")) return "Domain";
  return "Supporting";
}

function probableFile(node) {
  const metadata = node.metadata || {};
  const candidates = [
    metadata.file,
    metadata.path,
    metadata.filePath,
    metadata.source,
    node.id,
  ];

  return candidates.find((value) => typeof value === "string" && value.includes("/")) || node.id;
}

function rankMatches(graph, request, limit = 18) {
  const tokens = tokenize(request);

  return graph.nodes
    .map((node) => ({
      node,
      score: scoreNode(node, tokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({
      id: entry.node.id,
      label: entry.node.label,
      type: entry.node.type,
      layer: inferLayer(entry.node),
      file: probableFile(entry.node),
      features: entry.node.features || [],
      impactScore: Number(entry.node.impact?.score || 0),
      matchScore: Math.round(entry.score),
    }));
}

function relatedNodes(graph, selectedIds) {
  const selected = new Set(selectedIds);
  const related = new Set();

  for (const edge of graph.edges) {
    if (selected.has(edge.source)) related.add(edge.target);
    if (selected.has(edge.target)) related.add(edge.source);
  }

  return graph.nodes
    .filter((node) => related.has(node.id) && !selected.has(node.id))
    .sort(
      (a, b) =>
        Number(b.impact?.score || 0) - Number(a.impact?.score || 0),
    )
    .slice(0, 20)
    .map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      layer: inferLayer(node),
      file: probableFile(node),
      features: node.features || [],
      impactScore: Number(node.impact?.score || 0),
    }));
}

function buildPlan(graph, request) {
  const targets = rankMatches(graph, request);
  const related = relatedNodes(
    graph,
    targets.slice(0, 8).map((target) => target.id),
  );

  const layers = [...new Set(targets.map((target) => target.layer))];
  const affectedFeatures = [
    ...new Set([
      ...targets.flatMap((target) => target.features),
      ...related.flatMap((target) => target.features),
    ]),
  ].sort();

  const highestImpact = Math.max(
    0,
    ...targets.map((target) => target.impactScore),
    ...related.map((target) => target.impactScore),
  );

  const complexity =
    targets.length >= 14 || layers.length >= 5 || highestImpact >= 80
      ? "HIGH"
      : targets.length >= 7 || layers.length >= 3 || highestImpact >= 45
        ? "MEDIUM"
        : "LOW";

  const sequence = [];
  const order = ["Data", "Domain", "API", "UI", "Page", "Supporting"];

  for (const layer of order) {
    const matches = targets.filter((target) => target.layer === layer);
    if (!matches.length) continue;

    sequence.push({
      step: sequence.length + 1,
      layer,
      objective:
        layer === "Data"
          ? "Confirm schema, persistence, and migration requirements."
          : layer === "Domain"
            ? "Implement core business rules and reusable services."
            : layer === "API"
              ? "Add or update server routes and validation."
              : layer === "UI"
                ? "Update interactive components and user feedback."
                : layer === "Page"
                  ? "Wire the experience into the correct application route."
                  : "Update supporting utilities, reports, or documentation.",
      assets: matches.slice(0, 6),
    });
  }

  const validation = [
    "npx tsc --noEmit",
    "pnpm atlas:graph",
    "pnpm atlas:release-diff",
  ];

  if (layers.includes("Data")) {
    validation.unshift("pnpm prisma generate");
    validation.push("Review migration safety before applying database changes.");
  }

  if (layers.includes("API")) {
    validation.push("Exercise affected API routes with success and failure cases.");
  }

  if (layers.includes("UI") || layers.includes("Page")) {
    validation.push("Run focused browser validation for the affected workflow.");
  }

  const risks = [];
  if (highestImpact >= 50) {
    risks.push("One or more matched assets have high architecture impact.");
  }
  if (related.length >= 12) {
    risks.push("The requested change has a broad dependency blast radius.");
  }
  if (affectedFeatures.length >= 5) {
    risks.push("Multiple product features may require regression testing.");
  }
  if (!risks.length) {
    risks.push("No exceptional architecture risk was detected from the current graph.");
  }

  return {
    mode: "PLAN",
    request,
    generatedAt: new Date().toISOString(),
    complexity,
    confidence: targets.length ? Math.min(0.96, 0.45 + targets.length * 0.035) : 0.2,
    summary:
      targets.length > 0
        ? `ATLAS identified ${targets.length} likely implementation assets across ${layers.length} architecture layers.`
        : "ATLAS did not find a strong architecture match. Refine the request with a feature, route, model, or workflow name.",
    targets,
    related,
    affectedFeatures,
    sequence,
    risks,
    validation,
    reviewerChecklist: [
      "Confirm the selected architecture assets match the intended business workflow.",
      "Create a repository checkpoint before implementation.",
      "Implement in dependency order rather than editing UI first.",
      "Run focused regression checks for every affected feature.",
      "Capture a new ATLAS snapshot after validation passes.",
    ],
  };
}

function buildRegression(graph, request) {
  const plan = buildPlan(graph, request);

  return {
    ...plan,
    mode: "REGRESSION",
    summary: `ATLAS identified ${plan.affectedFeatures.length} feature areas and ${plan.related.length} related architecture assets that should be considered for regression testing.`,
    regressionAreas: [
      ...plan.affectedFeatures.map((feature) => ({
        area: feature,
        reason: "Feature is attached to a matched or dependent architecture asset.",
      })),
      ...plan.related.slice(0, 8).map((node) => ({
        area: node.label,
        reason: `Related ${node.type} asset with impact score ${node.impactScore}.`,
      })),
    ],
  };
}

function buildDebt(graph) {
  const cycles = graph.overlays?.cycles || [];
  const hotspots = [...graph.nodes]
    .sort(
      (a, b) =>
        Number(b.impact?.score || 0) - Number(a.impact?.score || 0),
    )
    .slice(0, 20)
    .map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      file: probableFile(node),
      impactScore: Number(node.impact?.score || 0),
      features: node.features || [],
    }));

  return {
    mode: "DEBT",
    generatedAt: new Date().toISOString(),
    summary: `ATLAS detected ${cycles.length} dependency cycles and ranked ${hotspots.length} high-impact architecture hotspots.`,
    cycles: cycles.slice(0, 25),
    hotspots,
    recommendations: [
      "Prioritize cycles containing high-impact models, APIs, or shared services.",
      "Split large cross-feature utilities into narrower domain-owned modules.",
      "Reduce components that coordinate unrelated workflows.",
      "Track hotspot and cycle movement with ATLAS release snapshots.",
      "Require focused tests before changing any top-ranked hotspot.",
    ],
  };
}

function argumentText() {
  return process.argv.slice(3).join(" ").trim();
}

function main() {
  const command = process.argv[2] || "help";
  const graph = readGraph();

  if (command === "plan") {
    console.log(JSON.stringify(buildPlan(graph, argumentText()), null, 2));
    return;
  }

  if (command === "regression") {
    console.log(JSON.stringify(buildRegression(graph, argumentText()), null, 2));
    return;
  }

  if (command === "debt") {
    console.log(JSON.stringify(buildDebt(graph), null, 2));
    return;
  }

  if (command === "self-test") {
    const result = buildPlan(graph, "vendor assessment review workflow");

    if (
      result.mode !== "PLAN" ||
      !Array.isArray(result.targets) ||
      !Array.isArray(result.validation) ||
      !result.validation.includes("npx tsc --noEmit")
    ) {
      throw new Error("ATLAS Engineering Copilot self-test failed.");
    }

    console.log("ATLAS-05A Engineering Copilot self-test passed.");
    console.log(`Matched targets: ${result.targets.length}`);
    console.log(`Complexity: ${result.complexity}`);
    return;
  }

  console.log("ATLAS-05A Engineering Copilot");
  console.log("");
  console.log('  plan "feature request"');
  console.log('  regression "change description"');
  console.log("  debt");
  console.log("  self-test");
}

module.exports = {
  buildDebt,
  buildPlan,
  buildRegression,
  rankMatches,
};

if (require.main === module) {
  main();
}
