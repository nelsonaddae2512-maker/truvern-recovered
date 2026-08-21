const fs = require("fs");
const path = require("path");

const root = process.cwd();
const outputDir = path.join(root, "tools", "atlas", "output");

function readJson(name, fallback = {}) {
  const file = path.join(outputDir, name);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function norm(value) {
  return String(value || "").replace(/\\/g, "/");
}

function nodeId(type, key) {
  return `${type}:${norm(key)}`;
}

const repo = readJson("repository-manifest.json", {});
const db = readJson("database-manifest.json", {});
const api = readJson("api-manifest.json", {});
const components = readJson("component-manifest.json", {});
const features = readJson("feature-manifest.json", {});

const nodes = new Map();
const edges = [];
const edgeKeys = new Set();

function addNode(id, type, label, metadata = {}) {
  if (!nodes.has(id)) {
    nodes.set(id, { id, type, label, metadata });
  } else {
    Object.assign(nodes.get(id).metadata, metadata);
  }
  return id;
}

function addEdge(from, to, kind, metadata = {}) {
  if (!from || !to || from === to) return;
  const key = `${from}|${to}|${kind}`;
  if (edgeKeys.has(key)) return;
  edgeKeys.add(key);
  edges.push({ from, to, kind, metadata });
}

for (const model of db.models || []) {
  const name = model.name || model.model;
  if (!name) continue;
  addNode(nodeId("model", name), "model", name, {
    fieldCount: model.fields?.length ?? model.fieldCount ?? null,
    relationCount: model.relations?.length ?? model.relationshipCount ?? null
  });
}

for (const route of api.routes || []) {
  const key = route.sourceFile || route.routePath;
  if (!key) continue;
  const id = addNode(nodeId("api", key), "api", route.routePath || key, {
    sourceFile: route.sourceFile,
    routePath: route.routePath,
    methods: route.methods || []
  });

  for (const model of route.prismaModels || route.models || []) {
    const modelNode = addNode(nodeId("model", model), "model", model);
    addEdge(id, modelNode, "uses-model");
  }
}

for (const component of components.components || []) {
  const key = component.sourceFile;
  if (!key) continue;
  const type = component.kind === "page" || component.kind === "layout" ? "page" : "component";
  const id = addNode(nodeId(type, key), type, key, {
    kind: component.kind,
    classification: component.classification,
    hooks: component.hooks || [],
    importedByCount: component.importedBy?.length || 0
  });

  for (const item of component.internalImports || []) {
    const resolved = typeof item === "string" ? item : item.resolved;
    if (!resolved) continue;
    const importedType = /\/page\.(tsx|ts|jsx|js)$/.test(resolved) || /\/layout\.(tsx|ts|jsx|js)$/.test(resolved)
      ? "page"
      : "component";
    const target = addNode(nodeId(importedType, resolved), importedType, resolved);
    addEdge(id, target, "imports");
  }
}

for (const feature of features.features || []) {
  const fid = addNode(nodeId("feature", feature.id), "feature", feature.name || feature.id, {
    confidence: feature.confidence,
    evidenceScore: feature.evidenceScore
  });

  const buckets = feature.assets || {};
  for (const item of buckets.pages || []) {
    const target = addNode(nodeId("page", item.path), "page", item.path);
    addEdge(fid, target, "contains");
  }
  for (const item of buckets.components || []) {
    const target = addNode(nodeId("component", item.path), "component", item.path);
    addEdge(fid, target, "contains");
  }
  for (const item of buckets.apis || []) {
    const target = addNode(nodeId("api", item.path), "api", item.routePath || item.path);
    addEdge(fid, target, "contains");
  }
  for (const item of buckets.models || []) {
    const modelName = (item.path || "").split("#").pop();
    if (!modelName) continue;
    const target = addNode(nodeId("model", modelName), "model", modelName);
    addEdge(fid, target, "contains");
  }
  for (const dep of feature.dependencyFeatureIds || []) {
    const target = addNode(nodeId("feature", dep), "feature", dep);
    addEdge(fid, target, "depends-on-feature");
  }
}

const outgoing = new Map();
const incoming = new Map();

for (const id of nodes.keys()) {
  outgoing.set(id, []);
  incoming.set(id, []);
}

for (const edge of edges) {
  outgoing.get(edge.from)?.push(edge);
  incoming.get(edge.to)?.push(edge);
}

function traverse(start, direction, maxDepth = 5) {
  const adjacency = direction === "forward" ? outgoing : incoming;
  const visited = new Set([start]);
  const queue = [{ id: start, depth: 0 }];
  const results = [];

  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;

    for (const edge of adjacency.get(current.id) || []) {
      const next = direction === "forward" ? edge.to : edge.from;
      if (visited.has(next)) continue;
      visited.add(next);
      const record = {
        id: next,
        depth: current.depth + 1,
        via: edge.kind
      };
      results.push(record);
      queue.push(record);
    }
  }

  return results;
}

function detectCycles() {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const colors = new Map([...nodes.keys()].map((id) => [id, WHITE]));
  const stack = [];
  const cycles = [];
  const seen = new Set();

  function dfs(id) {
    colors.set(id, GRAY);
    stack.push(id);

    for (const edge of outgoing.get(id) || []) {
      if (!["imports", "depends-on-feature"].includes(edge.kind)) continue;
      const next = edge.to;
      if (colors.get(next) === WHITE) {
        dfs(next);
      } else if (colors.get(next) === GRAY) {
        const index = stack.indexOf(next);
        const cycle = stack.slice(index).concat(next);
        const normalized = cycle.slice(0, -1).sort().join("|");
        if (!seen.has(normalized)) {
          seen.add(normalized);
          cycles.push(cycle);
        }
      }
    }

    stack.pop();
    colors.set(id, BLACK);
  }

  for (const id of nodes.keys()) {
    if (colors.get(id) === WHITE) dfs(id);
  }
  return cycles;
}

const impactIndex = {};
for (const [id, node] of nodes.entries()) {
  const forward = traverse(id, "forward", 5);
  const reverse = traverse(id, "reverse", 5);
  const directOut = outgoing.get(id) || [];
  const directIn = incoming.get(id) || [];

  const affectedFeatures = new Set();
  for (const item of reverse) {
    const n = nodes.get(item.id);
    if (n?.type === "feature") affectedFeatures.add(n.label);
  }

  const score =
    reverse.length * 3 +
    forward.length +
    directIn.length * 2 +
    directOut.length +
    affectedFeatures.size * 5;

  impactIndex[id] = {
    id,
    type: node.type,
    label: node.label,
    score,
    directDependencies: directOut.map((e) => ({ id: e.to, kind: e.kind })),
    directDependents: directIn.map((e) => ({ id: e.from, kind: e.kind })),
    forwardBlastRadius: forward,
    reverseBlastRadius: reverse,
    affectedFeatures: [...affectedFeatures].sort()
  };
}

const cycleCandidates = detectCycles();
const ranked = Object.values(impactIndex).sort((a, b) => b.score - a.score);

const featureCoupling = [];
const featureNodes = [...nodes.values()].filter((n) => n.type === "feature");
for (let i = 0; i < featureNodes.length; i++) {
  for (let j = i + 1; j < featureNodes.length; j++) {
    const a = featureNodes[i];
    const b = featureNodes[j];
    const aAssets = new Set((outgoing.get(a.id) || []).filter((e) => e.kind === "contains").map((e) => e.to));
    const bAssets = new Set((outgoing.get(b.id) || []).filter((e) => e.kind === "contains").map((e) => e.to));
    const shared = [...aAssets].filter((x) => bAssets.has(x));
    if (shared.length) {
      featureCoupling.push({
        featureA: a.label,
        featureB: b.label,
        sharedAssetCount: shared.length,
        sharedAssets: shared
      });
    }
  }
}

const graph = {
  generatedAt: new Date().toISOString(),
  sourceManifests: {
    repository: !!Object.keys(repo).length,
    database: !!Object.keys(db).length,
    api: !!Object.keys(api).length,
    components: !!Object.keys(components).length,
    features: !!Object.keys(features).length
  },
  summary: {
    nodes: nodes.size,
    edges: edges.length,
    features: [...nodes.values()].filter((n) => n.type === "feature").length,
    pages: [...nodes.values()].filter((n) => n.type === "page").length,
    components: [...nodes.values()].filter((n) => n.type === "component").length,
    apis: [...nodes.values()].filter((n) => n.type === "api").length,
    models: [...nodes.values()].filter((n) => n.type === "model").length,
    cycleCandidates: cycleCandidates.length,
    coupledFeaturePairs: featureCoupling.length
  },
  nodes: [...nodes.values()],
  edges,
  cycles: cycleCandidates,
  featureCoupling
};

function esc(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const registry = [
  "# Generated Dependency Registry",
  "",
  "> Generated by ATLAS-02F. Do not hand-edit; rerun `pnpm atlas:impact`.",
  "",
  `Generated: ${graph.generatedAt}`,
  "",
  "## Summary",
  "",
  `- Nodes: ${graph.summary.nodes}`,
  `- Edges: ${graph.summary.edges}`,
  `- Features: ${graph.summary.features}`,
  `- Pages: ${graph.summary.pages}`,
  `- Components: ${graph.summary.components}`,
  `- APIs: ${graph.summary.apis}`,
  `- Models: ${graph.summary.models}`,
  `- Cycle candidates: ${graph.summary.cycleCandidates}`,
  `- Coupled feature pairs: ${graph.summary.coupledFeaturePairs}`,
  "",
  "## Highest-impact assets",
  "",
  "| Rank | Asset | Type | Impact score | Direct dependents | Reverse blast radius | Affected features |",
  "|---:|---|---|---:|---:|---:|---:|",
  ...ranked.slice(0, 100).map((item, index) =>
    `| ${index + 1} | \`${esc(item.label)}\` | ${item.type} | ${item.score} | ` +
    `${item.directDependents.length} | ${item.reverseBlastRadius.length} | ${item.affectedFeatures.length} |`
  ),
  "",
  "## Cross-feature coupling",
  "",
  ...(featureCoupling.length
    ? featureCoupling
        .sort((a, b) => b.sharedAssetCount - a.sharedAssetCount)
        .map((item) => `- **${item.featureA} ↔ ${item.featureB}** — ${item.sharedAssetCount} shared assets`)
    : ["- None detected"]),
  "",
  "## Cycle candidates",
  "",
  ...(cycleCandidates.length
    ? cycleCandidates.slice(0, 50).map((cycle) => `- ${cycle.map((id) => `\`${id}\``).join(" → ")}`)
    : ["- None detected"]),
  ""
].join("\n");

const report = [
  "# ATLAS Dependency & Impact Intelligence Report",
  "",
  `Generated at ${graph.generatedAt}.`,
  "",
  "## Architecture graph",
  "",
  "| Metric | Count |",
  "|---|---:|",
  `| Nodes | ${graph.summary.nodes} |`,
  `| Edges | ${graph.summary.edges} |`,
  `| Feature nodes | ${graph.summary.features} |`,
  `| Page nodes | ${graph.summary.pages} |`,
  `| Component nodes | ${graph.summary.components} |`,
  `| API nodes | ${graph.summary.apis} |`,
  `| Model nodes | ${graph.summary.models} |`,
  `| Cycle candidates | ${graph.summary.cycleCandidates} |`,
  `| Coupled feature pairs | ${graph.summary.coupledFeaturePairs} |`,
  "",
  "## Top architectural hotspots",
  "",
  ...ranked.slice(0, 25).map((item, i) =>
    `${i + 1}. **${item.label}** — score ${item.score}; ${item.directDependents.length} direct dependents; ` +
    `${item.reverseBlastRadius.length} reverse-impact nodes; ${item.affectedFeatures.length} affected features`
  ),
  "",
  "## Highest cross-feature coupling",
  "",
  ...(featureCoupling.length
    ? featureCoupling
        .sort((a, b) => b.sharedAssetCount - a.sharedAssetCount)
        .slice(0, 25)
        .map((item) => `- **${item.featureA} / ${item.featureB}** — ${item.sharedAssetCount} shared assets`)
    : ["- None detected"]),
  "",
  "## Interpretation guidance",
  "",
  "- A high impact score indicates architectural centrality, not necessarily poor design.",
  "- Reverse blast radius identifies assets and features that may be affected when a node changes.",
  "- Cycle candidates are heuristic and should be reviewed before refactoring.",
  "- Feature coupling can be legitimate for shared governance services but may reveal separation opportunities.",
  "- The JSON impact index is designed for future CLI queries, dashboards, and release-impact checks.",
  ""
].join("\n");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(path.join(root, "governance"), { recursive: true });
fs.mkdirSync(path.join(root, "docs", "reports"), { recursive: true });

fs.writeFileSync(path.join(outputDir, "dependency-graph.json"), JSON.stringify(graph, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(outputDir, "impact-index.json"), JSON.stringify({
  generatedAt: graph.generatedAt,
  summary: graph.summary,
  rankedAssetIds: ranked.map((x) => x.id),
  assets: impactIndex
}, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(root, "governance", "DEPENDENCY_REGISTRY.generated.md"), registry, "utf8");
fs.writeFileSync(path.join(root, "docs", "reports", "ATLAS-DEPENDENCY-INTELLIGENCE.md"), report, "utf8");

console.log("ATLAS-02F dependency and impact intelligence complete.");
console.log(`Graph nodes: ${graph.summary.nodes}`);
console.log(`Graph edges: ${graph.summary.edges}`);
console.log(`Cycle candidates: ${graph.summary.cycleCandidates}`);
console.log(`Coupled feature pairs: ${graph.summary.coupledFeaturePairs}`);
console.log("Dependency graph: tools/atlas/output/dependency-graph.json");
console.log("Impact index: tools/atlas/output/impact-index.json");
console.log("Registry: governance/DEPENDENCY_REGISTRY.generated.md");
console.log("Report: docs/reports/ATLAS-DEPENDENCY-INTELLIGENCE.md");
