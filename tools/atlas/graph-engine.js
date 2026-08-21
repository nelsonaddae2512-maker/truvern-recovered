const fs = require("fs");
const path = require("path");

const root = process.cwd();
const outputDir = path.join(root, "tools", "atlas", "output");
const sourcePath = path.join(outputDir, "dependency-graph.json");
const impactPath = path.join(outputDir, "impact-index.json");
const explorerGraphPath = path.join(outputDir, "explorer-graph.json");
const explorerIndexPath = path.join(outputDir, "explorer-index.json");
const reportPath = path.join(root, "docs", "reports", "ATLAS-GRAPH-ENGINE.md");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/[^a-z0-9/_:.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

if (!fs.existsSync(sourcePath) || !fs.existsSync(impactPath)) {
  console.error("Missing ATLAS dependency artifacts.");
  console.error("Run `pnpm atlas:impact` first.");
  process.exit(1);
}

const graph = readJson(sourcePath);
const impact = readJson(impactPath);

const typeOrder = {
  feature: 0,
  page: 1,
  component: 2,
  api: 3,
  model: 4
};

const nodes = graph.nodes.map((node) => {
  const itemImpact = impact.assets?.[node.id] || null;
  return {
    id: node.id,
    key: slug(node.id),
    type: node.type,
    label: node.label,
    layer: typeOrder[node.type] ?? 99,
    metadata: node.metadata || {},
    impact: itemImpact
      ? {
          score: itemImpact.score,
          directDependencyCount: itemImpact.directDependencies?.length || 0,
          directDependentCount: itemImpact.directDependents?.length || 0,
          forwardBlastRadiusCount: itemImpact.forwardBlastRadius?.length || 0,
          reverseBlastRadiusCount: itemImpact.reverseBlastRadius?.length || 0,
          affectedFeatures: itemImpact.affectedFeatures || []
        }
      : null
  };
});

const nodeIds = new Set(nodes.map((node) => node.id));
const edges = graph.edges
  .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
  .map((edge, index) => ({
    id: `edge:${index + 1}`,
    source: edge.from,
    target: edge.to,
    kind: edge.kind,
    metadata: edge.metadata || {}
  }));

const featureMembership = {};
for (const edge of edges) {
  if (edge.kind !== "contains") continue;
  if (!featureMembership[edge.target]) featureMembership[edge.target] = [];
  featureMembership[edge.target].push(edge.source);
}

for (const node of nodes) {
  node.features = featureMembership[node.id] || [];
}

const searchDocuments = nodes.map((node) => ({
  id: node.id,
  type: node.type,
  label: node.label,
  normalized: [
    node.id,
    node.label,
    node.type,
    node.metadata?.sourceFile,
    node.metadata?.routePath,
    node.metadata?.kind,
    ...(node.features || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}));

const explorerGraph = {
  generatedAt: new Date().toISOString(),
  version: "ATLAS-03B-1",
  summary: {
    nodes: nodes.length,
    edges: edges.length,
    features: nodes.filter((n) => n.type === "feature").length,
    pages: nodes.filter((n) => n.type === "page").length,
    components: nodes.filter((n) => n.type === "component").length,
    apis: nodes.filter((n) => n.type === "api").length,
    models: nodes.filter((n) => n.type === "model").length,
    cycles: graph.cycles?.length || 0,
    featureCouplingPairs: graph.featureCoupling?.length || 0
  },
  nodes,
  edges,
  overlays: {
    cycles: graph.cycles || [],
    featureCoupling: graph.featureCoupling || []
  }
};

const explorerIndex = {
  generatedAt: explorerGraph.generatedAt,
  byId: Object.fromEntries(nodes.map((node) => [node.id, node])),
  byType: Object.fromEntries(
    [...new Set(nodes.map((node) => node.type))].map((type) => [
      type,
      nodes.filter((node) => node.type === type).map((node) => node.id)
    ])
  ),
  byFeature: Object.fromEntries(
    nodes
      .filter((node) => node.type === "feature")
      .map((feature) => [
        feature.id,
        edges.filter((edge) => edge.source === feature.id && edge.kind === "contains").map((edge) => edge.target)
      ])
  ),
  hotspots: nodes
    .filter((node) => node.impact)
    .sort((a, b) => (b.impact?.score || 0) - (a.impact?.score || 0))
    .map((node) => node.id),
  searchDocuments
};

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

fs.writeFileSync(explorerGraphPath, JSON.stringify(explorerGraph, null, 2) + "\n", "utf8");
fs.writeFileSync(explorerIndexPath, JSON.stringify(explorerIndex, null, 2) + "\n", "utf8");

const report = [
  "# ATLAS Graph Engine",
  "",
  `Generated at ${explorerGraph.generatedAt}.`,
  "",
  "## Explorer graph",
  "",
  `- Nodes: ${explorerGraph.summary.nodes}`,
  `- Edges: ${explorerGraph.summary.edges}`,
  `- Features: ${explorerGraph.summary.features}`,
  `- Pages: ${explorerGraph.summary.pages}`,
  `- Components: ${explorerGraph.summary.components}`,
  `- APIs: ${explorerGraph.summary.apis}`,
  `- Models: ${explorerGraph.summary.models}`,
  `- Cycle overlays: ${explorerGraph.summary.cycles}`,
  `- Feature-coupling overlays: ${explorerGraph.summary.featureCouplingPairs}`,
  "",
  "## Purpose",
  "",
  "The graph engine transforms ATLAS dependency intelligence into a stable, explorer-ready payload.",
  "",
  "It provides normalized nodes, normalized edges, layer metadata, feature membership, impact summaries, search documents, hotspot ordering, and overlay data.",
  ""
].join("\n");

fs.writeFileSync(reportPath, report, "utf8");

console.log("ATLAS-03B-1 graph engine complete.");
console.log(`Explorer nodes: ${explorerGraph.summary.nodes}`);
console.log(`Explorer edges: ${explorerGraph.summary.edges}`);
console.log(`Cycles: ${explorerGraph.summary.cycles}`);
console.log(`Feature coupling pairs: ${explorerGraph.summary.featureCouplingPairs}`);
console.log("Graph: tools/atlas/output/explorer-graph.json");
console.log("Index: tools/atlas/output/explorer-index.json");
