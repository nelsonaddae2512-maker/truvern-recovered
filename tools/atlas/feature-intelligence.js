const fs = require("fs");
const path = require("path");

const root = process.cwd();
const atlasOutput = path.join(root, "tools", "atlas", "output");
const configPath = path.join(root, "tools", "atlas", "feature-map.config.json");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const ignored = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage", ".turbo"]);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function humanize(value) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[\[\]()]/g, " ")
    .replace(/[-_/.]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function assetText(asset) {
  return [
    asset.path,
    asset.routePath,
    asset.name,
    asset.kind,
    asset.models?.join(" "),
    asset.imports?.join(" "),
    asset.exports?.join(" "),
    asset.contentHint
  ].filter(Boolean).join(" ").toLowerCase();
}

function scoreFeature(text, feature) {
  let score = 0;
  const matchedKeywords = [];
  for (const keyword of feature.keywords) {
    const k = keyword.toLowerCase();
    if (!text.includes(k)) continue;
    matchedKeywords.push(keyword);
    score += k.includes(" ") ? 4 : 2;
    if (text.includes(`/${k}/`) || text.includes(`-${k}-`) || text.includes(`_${k}_`)) score += 1;
  }
  return { score, matchedKeywords };
}

function addUnique(target, value) {
  if (value && !target.includes(value)) target.push(value);
}

const config = readJson(configPath, null);
if (!config || !Array.isArray(config.features)) {
  console.error(`Feature configuration not found or invalid: ${configPath}`);
  process.exit(1);
}

const repoManifest = readJson(path.join(atlasOutput, "repository-manifest.json"), {});
const dbManifest = readJson(path.join(atlasOutput, "database-manifest.json"), {});
const apiManifest = readJson(path.join(atlasOutput, "api-manifest.json"), {});
const componentManifest = readJson(path.join(atlasOutput, "component-manifest.json"), {});

const assets = [];

for (const route of apiManifest.routes || []) {
  assets.push({
    type: "api",
    path: route.sourceFile,
    routePath: route.routePath,
    methods: route.methods || [],
    models: route.prismaModels || [],
    imports: route.imports || [],
    contentHint: humanize(`${route.routePath} ${route.sourceFile}`)
  });
}

for (const component of componentManifest.components || []) {
  assets.push({
    type: component.kind === "page" || component.kind === "layout" ? "page" : "component",
    path: component.sourceFile,
    kind: component.kind,
    imports: (component.internalImports || []).map((x) => x.resolved || x.specifier),
    exports: [
      ...(component.exports?.named || []),
      ...(component.exports?.hasDefault ? ["default"] : [])
    ],
    contentHint: humanize(component.sourceFile)
  });
}

for (const model of dbManifest.models || []) {
  const modelName = model.name || model.model || "";
  assets.push({
    type: "model",
    path: `prisma/schema.prisma#${modelName}`,
    name: modelName,
    contentHint: humanize(modelName)
  });
}

const scanFiles = [
  ...walk(path.join(root, "lib")),
  ...walk(path.join(root, "docs")),
  ...walk(path.join(root, "tests")),
  ...walk(path.join(root, "__tests__")),
  ...walk(path.join(root, "scripts"))
];

for (const file of scanFiles) {
  const rel = toPosix(path.relative(root, file));
  const ext = path.extname(file).toLowerCase();
  if (![".ts", ".tsx", ".js", ".jsx", ".md", ".mdx", ".json"].includes(ext)) continue;
  let content = "";
  try {
    content = fs.readFileSync(file, "utf8").slice(0, 40000);
  } catch {
    continue;
  }

  const type =
    rel.startsWith("docs/") ? "documentation" :
    rel.startsWith("tests/") || rel.startsWith("__tests__/") || /\.(test|spec)\./.test(rel) ? "test" :
    rel.startsWith("lib/") ? "library" :
    rel.startsWith("scripts/") ? "script" :
    "file";

  assets.push({
    type,
    path: rel,
    contentHint: `${humanize(rel)} ${content.toLowerCase()}`
  });
}

const deduped = [];
const seen = new Set();
for (const asset of assets) {
  const key = `${asset.type}:${asset.path}`;
  if (seen.has(key)) continue;
  seen.add(key);
  deduped.push(asset);
}

const features = config.features.map((feature) => ({
  id: feature.id,
  name: feature.name,
  keywords: feature.keywords,
  assets: {
    pages: [],
    components: [],
    apis: [],
    models: [],
    libraries: [],
    tests: [],
    documentation: [],
    scripts: [],
    other: []
  },
  dependencyFeatureIds: [],
  evidenceScore: 0,
  confidence: "low",
  coverage: {
    hasPage: false,
    hasApi: false,
    hasModel: false,
    hasTest: false,
    hasDocumentation: false
  }
}));

const featureById = new Map(features.map((f) => [f.id, f]));
const unassigned = [];

for (const asset of deduped) {
  const text = assetText(asset);
  const scored = config.features
    .map((feature) => ({ feature, ...scoreFeature(text, feature) }))
    .filter((item) => item.score >= (config.minimumScore || 2))
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maximumAssignmentsPerAsset || 3);

  if (!scored.length) {
    unassigned.push({ type: asset.type, path: asset.path });
    continue;
  }

  for (const match of scored) {
    const target = featureById.get(match.feature.id);
    const record = {
      path: asset.path,
      score: match.score,
      matchedKeywords: match.matchedKeywords,
      ...(asset.routePath ? { routePath: asset.routePath } : {}),
      ...(asset.methods ? { methods: asset.methods } : {}),
      ...(asset.models ? { models: asset.models } : {})
    };

    const bucket =
      asset.type === "page" ? "pages" :
      asset.type === "component" ? "components" :
      asset.type === "api" ? "apis" :
      asset.type === "model" ? "models" :
      asset.type === "library" ? "libraries" :
      asset.type === "test" ? "tests" :
      asset.type === "documentation" ? "documentation" :
      asset.type === "script" ? "scripts" :
      "other";

    target.assets[bucket].push(record);
    target.evidenceScore += match.score;
  }
}

for (const feature of features) {
  feature.coverage.hasPage = feature.assets.pages.length > 0;
  feature.coverage.hasApi = feature.assets.apis.length > 0;
  feature.coverage.hasModel = feature.assets.models.length > 0;
  feature.coverage.hasTest = feature.assets.tests.length > 0;
  feature.coverage.hasDocumentation = feature.assets.documentation.length > 0;

  const distinctTypes = Object.values(feature.assets).filter((items) => items.length > 0).length;
  feature.confidence =
    feature.evidenceScore >= 40 && distinctTypes >= 4 ? "high" :
    feature.evidenceScore >= 15 && distinctTypes >= 2 ? "medium" :
    "low";

  const linkedPaths = new Set([
    ...feature.assets.pages.map((x) => x.path),
    ...feature.assets.components.map((x) => x.path),
    ...feature.assets.apis.map((x) => x.path),
    ...feature.assets.libraries.map((x) => x.path)
  ]);

  for (const other of features) {
    if (other.id === feature.id) continue;
    const overlap = [
      ...other.assets.pages,
      ...other.assets.components,
      ...other.assets.apis,
      ...other.assets.libraries
    ].some((x) => linkedPaths.has(x.path));
    if (overlap) addUnique(feature.dependencyFeatureIds, other.id);
  }
}

const reviewCandidates = features
  .filter((feature) =>
    feature.confidence === "low" ||
    !feature.coverage.hasApi ||
    !feature.coverage.hasTest ||
    !feature.coverage.hasDocumentation
  )
  .map((feature) => ({
    featureId: feature.id,
    featureName: feature.name,
    confidence: feature.confidence,
    missing: [
      ...(!feature.coverage.hasPage ? ["page"] : []),
      ...(!feature.coverage.hasApi ? ["api"] : []),
      ...(!feature.coverage.hasModel ? ["model"] : []),
      ...(!feature.coverage.hasTest ? ["test"] : []),
      ...(!feature.coverage.hasDocumentation ? ["documentation"] : [])
    ]
  }));

const summary = {
  configuredFeatures: features.length,
  highConfidenceFeatures: features.filter((f) => f.confidence === "high").length,
  mediumConfidenceFeatures: features.filter((f) => f.confidence === "medium").length,
  lowConfidenceFeatures: features.filter((f) => f.confidence === "low").length,
  correlatedAssets: deduped.length - unassigned.length,
  unassignedAssets: unassigned.length,
  reviewCandidates: reviewCandidates.length
};

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceManifests: {
    repository: fs.existsSync(path.join(atlasOutput, "repository-manifest.json")),
    database: fs.existsSync(path.join(atlasOutput, "database-manifest.json")),
    api: fs.existsSync(path.join(atlasOutput, "api-manifest.json")),
    components: fs.existsSync(path.join(atlasOutput, "component-manifest.json"))
  },
  summary,
  features,
  reviewCandidates,
  unassignedAssets: unassigned
};

function esc(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function assetCount(feature) {
  return Object.values(feature.assets).reduce((sum, list) => sum + list.length, 0);
}

const registry = [
  "# Generated Feature Registry",
  "",
  "> Generated by ATLAS-02E. Do not hand-edit this file; update `tools/atlas/feature-map.config.json` or source code and rerun `pnpm atlas:features`.",
  "",
  `Generated: ${manifest.generatedAt}`,
  "",
  "## Summary",
  "",
  `- Configured features: ${summary.configuredFeatures}`,
  `- High confidence: ${summary.highConfidenceFeatures}`,
  `- Medium confidence: ${summary.mediumConfidenceFeatures}`,
  `- Low confidence: ${summary.lowConfidenceFeatures}`,
  `- Correlated assets: ${summary.correlatedAssets}`,
  `- Unassigned assets: ${summary.unassignedAssets}`,
  "",
  "## Feature catalog",
  "",
  "| Feature | Confidence | Pages | Components | APIs | Models | Libraries | Tests | Docs | Dependencies |",
  "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  ...features.map((f) =>
    `| ${esc(f.name)} | ${f.confidence} | ${f.assets.pages.length} | ${f.assets.components.length} | ` +
    `${f.assets.apis.length} | ${f.assets.models.length} | ${f.assets.libraries.length} | ` +
    `${f.assets.tests.length} | ${f.assets.documentation.length} | ${f.dependencyFeatureIds.length} |`
  ),
  "",
  ...features.flatMap((f) => [
    `## ${f.name}`,
    "",
    `- Feature ID: \`${f.id}\``,
    `- Confidence: ${f.confidence}`,
    `- Evidence score: ${f.evidenceScore}`,
    `- Total correlated assets: ${assetCount(f)}`,
    `- Cross-feature dependencies: ${f.dependencyFeatureIds.length ? f.dependencyFeatureIds.join(", ") : "None detected"}`,
    "",
    "### Pages",
    ...(f.assets.pages.length ? f.assets.pages.map((x) => `- \`${x.path}\``) : ["- None detected"]),
    "",
    "### APIs",
    ...(f.assets.apis.length ? f.assets.apis.map((x) => `- \`${x.routePath || x.path}\``) : ["- None detected"]),
    "",
    "### Models",
    ...(f.assets.models.length ? f.assets.models.map((x) => `- \`${x.path}\``) : ["- None detected"]),
    "",
    "### Components",
    ...(f.assets.components.length ? f.assets.components.slice(0, 50).map((x) => `- \`${x.path}\``) : ["- None detected"]),
    ...(f.assets.components.length > 50 ? [`- ...and ${f.assets.components.length - 50} more`] : []),
    ""
  ])
].join("\n");

const report = [
  "# ATLAS Feature Intelligence Report",
  "",
  `Generated at ${manifest.generatedAt}.`,
  "",
  "## Coverage summary",
  "",
  "| Metric | Count |",
  "|---|---:|",
  `| Configured features | ${summary.configuredFeatures} |`,
  `| High-confidence features | ${summary.highConfidenceFeatures} |`,
  `| Medium-confidence features | ${summary.mediumConfidenceFeatures} |`,
  `| Low-confidence features | ${summary.lowConfidenceFeatures} |`,
  `| Correlated assets | ${summary.correlatedAssets} |`,
  `| Unassigned assets | ${summary.unassignedAssets} |`,
  `| Review candidates | ${summary.reviewCandidates} |`,
  "",
  "## Feature coverage gaps",
  "",
  ...reviewCandidates.map((x) =>
    `- **${x.featureName}** — confidence: ${x.confidence}; missing: ${x.missing.join(", ") || "none"}`
  ),
  "",
  "## Highest-evidence features",
  "",
  ...features
    .slice()
    .sort((a, b) => b.evidenceScore - a.evidenceScore)
    .map((f) => `- **${f.name}** — evidence score ${f.evidenceScore}, ${assetCount(f)} correlated assets`),
  "",
  "## Notes",
  "",
  "- Feature assignment is heuristic and configurable.",
  "- Assets may belong to more than one feature when cross-cutting concerns are detected.",
  "- Low confidence does not mean the feature is incomplete; it means static evidence was limited.",
  "- Edit `tools/atlas/feature-map.config.json` to refine naming, keywords, and assignment thresholds.",
  ""
].join("\n");

const outputDir = path.join(root, "tools", "atlas", "output");
const governanceDir = path.join(root, "governance");
const reportsDir = path.join(root, "docs", "reports");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(governanceDir, { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });

fs.writeFileSync(path.join(outputDir, "feature-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(governanceDir, "FEATURE_REGISTRY.generated.md"), registry, "utf8");
fs.writeFileSync(path.join(reportsDir, "ATLAS-FEATURE-INTELLIGENCE.md"), report, "utf8");

console.log("ATLAS-02E feature intelligence complete.");
console.log(`Configured features: ${summary.configuredFeatures}`);
console.log(`High-confidence features: ${summary.highConfidenceFeatures}`);
console.log(`Medium-confidence features: ${summary.mediumConfidenceFeatures}`);
console.log(`Low-confidence features: ${summary.lowConfidenceFeatures}`);
console.log(`Correlated assets: ${summary.correlatedAssets}`);
console.log(`Unassigned assets: ${summary.unassignedAssets}`);
console.log("Manifest: tools/atlas/output/feature-manifest.json");
console.log("Registry: governance/FEATURE_REGISTRY.generated.md");
console.log("Report: docs/reports/ATLAS-FEATURE-INTELLIGENCE.md");
