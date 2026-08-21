#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const rulesPath = path.join(root, "tools", "atlas", "semantic-intelligence.rules.json");
const outputDir = path.join(root, "tools", "atlas", "output");
const jsonPath = path.join(outputDir, "semantic-repository-intelligence.json");
const reportPath = path.join(outputDir, "semantic-repository-intelligence-report.md");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalize(p) {
  return p.split(path.sep).join("/");
}

function walk(dir, rules, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = normalize(path.relative(root, full));
    if (entry.isDirectory()) {
      if (rules.excludeDirectories.some((item) => rel === item || rel.startsWith(item + "/"))) continue;
      walk(full, rules, files);
    } else if (rules.extensions.includes(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function inferKinds(rel, text) {
  const kinds = [];
  if (/\/route\.(ts|js)$/.test(rel)) kinds.push("api-route");
  if (/\/page\.(tsx|jsx|ts|js)$/.test(rel)) kinds.push("page");
  if (/\/layout\.(tsx|jsx|ts|js)$/.test(rel)) kinds.push("layout");
  if (rel.startsWith("components/")) kinds.push("component");
  if (rel.startsWith("lib/")) kinds.push("library");
  if (rel === "prisma/schema.prisma") kinds.push("schema");
  if (/\buse client\b/.test(text)) kinds.push("client");
  if (/\bserver-only\b/.test(text) || /\bexport const dynamic\b/.test(text)) kinds.push("server");
  return [...new Set(kinds)];
}

function extractImports(text) {
  const imports = [];
  const regexes = [
    /from\s+["']([^"']+)["']/g,
    /require\(["']([^"']+)["']\)/g,
    /import\(["']([^"']+)["']\)/g
  ];
  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(text))) imports.push(match[1]);
  }
  return [...new Set(imports)];
}

function extractExports(text) {
  const exports = [];
  const regex = /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|type|interface|enum)\s+([A-Za-z0-9_]+)/g;
  let match;
  while ((match = regex.exec(text))) exports.push(match[1]);
  return [...new Set(exports)];
}

function inferFeatures(rel, text, rules) {
  const haystack = `${rel}\n${text}`.toLowerCase();
  const matches = [];
  for (const [feature, keywords] of Object.entries(rules.featureKeywords)) {
    const hits = keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
    if (hits.length) matches.push({ feature, hits });
  }
  return matches.sort((a, b) => b.hits.length - a.hits.length);
}

function routeInfo(rel, text) {
  if (!/\/route\.(ts|js)$/.test(rel)) return null;
  const methods = [];
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b|export\\s+const\\s+${method}\\b`).test(text)) methods.push(method);
  }
  const route = "/" + rel.replace(/^app\//, "").replace(/\/route\.(ts|js)$/, "");
  return { route, methods };
}

function stateTransitions(text) {
  const statuses = [...text.matchAll(/\b(?:status|state)\s*[:=]\s*["']([A-Z][A-Z0-9_]+)["']/g)].map((m) => m[1]);
  return [...new Set(statuses)];
}

function prismaModels(schemaText) {
  return [...schemaText.matchAll(/model\s+([A-Za-z0-9_]+)\s*\{/g)].map((m) => m[1]);
}

function testPriority(file) {
  let score = 0;
  const reasons = [];
  const add = (points, reason) => { score += points; reasons.push(reason); };
  if (file.kinds.includes("api-route")) add(5, "API route");
  if (file.signals.databaseAccess) add(5, "Database access");
  if (file.signals.authentication) add(4, "Authentication or authorization");
  if (file.signals.stateTransition) add(4, "Workflow state transition");
  if (file.signals.billing) add(5, "Credits or billing");
  if (file.signals.release) add(5, "Governance release");
  if (file.signals.token) add(4, "Token lifecycle");
  if (file.signals.findingGeneration) add(5, "Finding generation");
  if (file.lineCount >= 500) add(2, "Large implementation surface");
  return { score, reasons };
}

function semanticName(file) {
  const primary = file.features[0]?.feature || "repository";
  const kind = file.kinds[0] || "module";
  return `${primary}/${kind}`;
}

function buildJourney(files, name, orderedFeatures) {
  const steps = orderedFeatures.map((feature, index) => {
    const candidates = files
      .filter((file) => file.features.some((item) => item.feature === feature))
      .sort((a, b) => b.testPriority.score - a.testPriority.score)
      .slice(0, 5)
      .map((file) => file.path);
    return { order: index + 1, feature, representativeFiles: candidates };
  });
  return { name, steps, completeness: steps.filter((s) => s.representativeFiles.length).length / steps.length };
}

function main() {
  const command = process.argv[2] || "report";
  const rules = readJson(rulesPath);

  if (command === "self-test") {
    const sample = {
      path: "app/api/vendor/submit/route.ts",
      kinds: ["api-route"],
      signals: { databaseAccess: true, authentication: true, stateTransition: true, billing: false, release: false, token: true, findingGeneration: false },
      lineCount: 120
    };
    const priority = testPriority(sample);
    if (priority.score < 15) throw new Error("Semantic self-test failed.");
    console.log("ATLAS-10 Semantic Repository Intelligence self-test passed.");
    console.log(`Sample test priority: ${priority.score}`);
    console.log("Application code modification: DISABLED");
    return;
  }

  const sourceFiles = [];
  for (const includeRoot of rules.includeRoots) {
    walk(path.join(root, includeRoot), rules, sourceFiles);
  }

  const files = sourceFiles.map((full) => {
    const rel = normalize(path.relative(root, full));
    const text = fs.readFileSync(full, "utf8");
    const kinds = inferKinds(rel, text);
    const features = inferFeatures(rel, text, rules);
    const route = routeInfo(rel, text);
    const transitions = stateTransitions(text);
    const signals = {
      databaseAccess: /\bprisma\.|\$queryRaw|\$executeRaw/.test(text),
      authentication: /\bClerk\b|auth\(|currentUser|sessionClaims|membership|role/.test(text),
      stateTransition: transitions.length > 0 || /\bstatus\s*[:=]/.test(text),
      billing: /\bcredit\b|\bStripe\b|checkout|payment|billing/i.test(text),
      release: /\brelease\b|snapshot|seal|board-ready|attestation/i.test(text),
      token: /\btoken\b|portalToken|revoke/i.test(text),
      findingGeneration: /generate.*finding|finding.*generate|remediation/i.test(text)
    };
    const file = {
      path: rel,
      kinds,
      lineCount: text.split(/\r?\n/).length,
      imports: extractImports(text),
      exports: extractExports(text),
      route,
      features,
      workflowStates: transitions,
      signals,
      testPriority: null
    };
    file.testPriority = testPriority(file);
    file.semanticArea = semanticName(file);
    return file;
  });

  const featureMap = {};
  for (const file of files) {
    for (const feature of file.features) {
      featureMap[feature.feature] ||= { files: [], routes: [], totalPriority: 0 };
      featureMap[feature.feature].files.push(file.path);
      if (file.route) featureMap[feature.feature].routes.push(file.route);
      featureMap[feature.feature].totalPriority += file.testPriority.score;
    }
  }

  const schemaFile = files.find((file) => file.path === "prisma/schema.prisma");
  const schemaText = schemaFile ? fs.readFileSync(path.join(root, schemaFile.path), "utf8") : "";
  const models = prismaModels(schemaText);

  const highPriorityTests = files
    .filter((file) => file.testPriority.score > 0)
    .sort((a, b) => b.testPriority.score - a.testPriority.score || a.path.localeCompare(b.path))
    .slice(0, 40)
    .map((file, index) => ({
      rank: index + 1,
      file: file.path,
      semanticArea: file.semanticArea,
      score: file.testPriority.score,
      reasons: file.testPriority.reasons,
      suggestedTestType: file.kinds.includes("api-route") ? "route integration test" :
        file.kinds.includes("component") ? "component behavior test" :
        file.signals.databaseAccess ? "service integration test" : "unit test",
      suggestedTestPath: `tests/${file.path.replace(/\.(tsx?|jsx?)$/, "").replace(/[()[\]]/g, "")}.test.ts`
    }));

  const journeys = [
    buildJourney(files, "Vendor assessment lifecycle", [
      "vendor-governance", "assessment", "vendor-portal", "evidence", "review", "findings", "governance-release"
    ]),
    buildJourney(files, "Truvern Review lifecycle", [
      "vendor-governance", "assessment", "operations", "review", "findings", "governance-release"
    ]),
    buildJourney(files, "Credits and managed review lifecycle", [
      "credits-billing", "vendor-governance", "review", "operations", "reporting"
    ])
  ];

  const result = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    engineVersion: "ATLAS-10",
    mode: "ANALYSIS_ONLY",
    summary: {
      filesAnalyzed: files.length,
      apiRoutes: files.filter((f) => f.kinds.includes("api-route")).length,
      pages: files.filter((f) => f.kinds.includes("page")).length,
      components: files.filter((f) => f.kinds.includes("component")).length,
      prismaModels: models.length,
      semanticFeatures: Object.keys(featureMap).length,
      highPriorityTestTargets: highPriorityTests.length,
      journeys: journeys.length
    },
    prismaModels: models,
    features: Object.entries(featureMap)
      .map(([name, value]) => ({
        name,
        fileCount: value.files.length,
        routeCount: value.routes.length,
        totalTestPriority: value.totalPriority,
        files: value.files,
        routes: value.routes
      }))
      .sort((a, b) => b.totalTestPriority - a.totalTestPriority),
    journeys,
    highPriorityTests,
    files
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  fs.writeFileSync(reportPath, markdown(result) + "\n", "utf8");

  console.log("ATLAS-10 Semantic Repository Intelligence complete.");
  console.log(`Files analyzed: ${result.summary.filesAnalyzed}`);
  console.log(`API routes: ${result.summary.apiRoutes}`);
  console.log(`Pages: ${result.summary.pages}`);
  console.log(`Components: ${result.summary.components}`);
  console.log(`Prisma models: ${result.summary.prismaModels}`);
  console.log(`Semantic features: ${result.summary.semanticFeatures}`);
  console.log(`High-priority test targets: ${result.summary.highPriorityTestTargets}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Report: ${reportPath}`);
}

function markdown(result) {
  const lines = [
    "# ATLAS-10 Semantic Repository Intelligence", "",
    `Generated: ${result.generatedAt}`,
    `Mode: ${result.mode}`, "",
    "## Repository Summary", "",
    `- Files analyzed: ${result.summary.filesAnalyzed}`,
    `- API routes: ${result.summary.apiRoutes}`,
    `- Pages: ${result.summary.pages}`,
    `- Components: ${result.summary.components}`,
    `- Prisma models: ${result.summary.prismaModels}`,
    `- Semantic features: ${result.summary.semanticFeatures}`,
    `- High-priority test targets: ${result.summary.highPriorityTestTargets}`, "",
    "## Feature Map", ""
  ];

  for (const feature of result.features) {
    lines.push(
      `### ${feature.name}`, "",
      `- Files: ${feature.fileCount}`,
      `- Routes: ${feature.routeCount}`,
      `- Aggregate test priority: ${feature.totalTestPriority}`, ""
    );
  }

  lines.push("## Inferred Business Journeys", "");
  for (const journey of result.journeys) {
    lines.push(`### ${journey.name}`, "", `Completeness: ${Math.round(journey.completeness * 100)}%`, "");
    for (const step of journey.steps) {
      lines.push(`${step.order}. **${step.feature}**`);
      for (const file of step.representativeFiles.slice(0, 3)) lines.push(`   - \`${file}\``);
    }
    lines.push("");
  }

  lines.push("## Highest-Priority Test Targets", "");
  for (const target of result.highPriorityTests.slice(0, 20)) {
    lines.push(
      `### ${target.rank}. ${target.file}`, "",
      `- Semantic area: ${target.semanticArea}`,
      `- Priority: ${target.score}`,
      `- Test type: ${target.suggestedTestType}`,
      `- Suggested path: \`${target.suggestedTestPath}\``,
      `- Reasons: ${target.reasons.join(", ")}`, ""
    );
  }
  return lines.join("\n");
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
