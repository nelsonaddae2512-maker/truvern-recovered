const fs = require("fs");
const path = require("path");

const root = process.cwd();
const scanRoots = ["app", "components"].map((p) => path.join(root, p)).filter(fs.existsSync);
const extensions = new Set([".tsx", ".jsx", ".ts", ".js"]);
const ignoredDirs = new Set([
  "node_modules", ".next", ".git", "dist", "build", "coverage",
  "generated", ".turbo", "public", "prisma"
]);

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (extensions.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function isComponentLike(file, source) {
  const ext = path.extname(file);
  if (ext === ".tsx" || ext === ".jsx") return true;
  return /return\s*\(\s*</.test(source) || /=>\s*</.test(source) || /React\.createElement/.test(source);
}

function routeKind(rel) {
  const name = path.basename(rel).replace(/\.(tsx|jsx|ts|js)$/, "");
  const normalized = toPosix(rel);
  if (/\/page\.(tsx|jsx|ts|js)$/.test(normalized)) return "page";
  if (/\/layout\.(tsx|jsx|ts|js)$/.test(normalized)) return "layout";
  if (/\/loading\.(tsx|jsx|ts|js)$/.test(normalized)) return "loading";
  if (/\/error\.(tsx|jsx|ts|js)$/.test(normalized)) return "error";
  if (/\/not-found\.(tsx|jsx|ts|js)$/.test(normalized)) return "not-found";
  if (/\/template\.(tsx|jsx|ts|js)$/.test(normalized)) return "template";
  if (/\/default\.(tsx|jsx|ts|js)$/.test(normalized)) return "parallel-route-default";
  if (/\/route\.(tsx|jsx|ts|js)$/.test(normalized)) return "route-handler";
  if (normalized.startsWith("components/")) return "shared-component";
  return "module";
}

function detectImports(source) {
  const imports = [];
  const regex = /import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+["']([^"']+)["'];?|import\s+["']([^"']+)["'];?/g;
  let m;
  while ((m = regex.exec(source))) {
    imports.push(m[1] || m[2]);
  }
  return [...new Set(imports)].sort();
}

function resolveInternalImport(importer, specifier) {
  let target;
  if (specifier.startsWith("@/")) {
    target = path.join(root, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    target = path.resolve(path.dirname(importer), specifier);
  } else {
    return null;
  }

  const candidates = [
    target,
    ...[".tsx", ".ts", ".jsx", ".js"].map((ext) => target + ext),
    ...["index.tsx", "index.ts", "index.jsx", "index.js"].map((name) => path.join(target, name))
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  return match ? toPosix(path.relative(root, match)) : toPosix(path.relative(root, target));
}

function detectExports(source) {
  const named = new Set();
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    /export\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    /export\s+(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    /export\s*{\s*([^}]+)\s*}/g
  ];
  for (const regex of patterns) {
    let m;
    while ((m = regex.exec(source))) {
      if (regex === patterns[3]) {
        m[1].split(",").forEach((part) => {
          const item = part.trim().split(/\s+as\s+/).pop();
          if (item) named.add(item.trim());
        });
      } else {
        named.add(m[1]);
      }
    }
  }
  return {
    hasDefault: /export\s+default\b/.test(source),
    named: [...named].sort()
  };
}

function detectHooks(source) {
  const hooks = new Set();
  const regex = /\b(use[A-Z][A-Za-z0-9_]*)\s*\(/g;
  let m;
  while ((m = regex.exec(source))) hooks.add(m[1]);
  return [...hooks].sort();
}

function detectJsxReferences(source) {
  const refs = new Set();
  const regex = /<([A-Z][A-Za-z0-9_.]*)\b/g;
  let m;
  while ((m = regex.exec(source))) refs.add(m[1]);
  return [...refs].sort();
}

function detectProps(source) {
  const props = new Set();
  const patterns = [
    /interface\s+([A-Za-z_][A-Za-z0-9_]*Props)\b/g,
    /type\s+([A-Za-z_][A-Za-z0-9_]*Props)\s*=/g,
    /function\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*:\s*([A-Za-z_][A-Za-z0-9_]*Props)\b/g,
    /(?:const|let)\s+[A-Za-z_][A-Za-z0-9_]*\s*=\s*\([^)]*:\s*([A-Za-z_][A-Za-z0-9_]*Props)\b/g
  ];
  for (const regex of patterns) {
    let m;
    while ((m = regex.exec(source))) props.add(m[1]);
  }
  return [...props].sort();
}

const files = scanRoots.flatMap((dir) => walk(dir)).sort();
const entries = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  if (!isComponentLike(file, source)) continue;

  const rel = toPosix(path.relative(root, file));
  const imports = detectImports(source);
  const internalImports = imports
    .map((specifier) => ({ specifier, resolved: resolveInternalImport(file, specifier) }))
    .filter((item) => item.resolved);
  const thirdPartyImports = imports.filter((specifier) => !specifier.startsWith(".") && !specifier.startsWith("@/"));

  const clientDirective = /^\s*["']use client["'];?/m.test(source);
  const serverDirective = /^\s*["']use server["'];?/m.test(source);
  const kind = routeKind(rel);
  const classification = clientDirective
    ? "client"
    : serverDirective
      ? "server-action-module"
      : kind === "route-handler"
        ? "server"
        : "server-default";

  const exports = detectExports(source);
  const hooks = detectHooks(source);
  const jsxReferences = detectJsxReferences(source);
  const propTypes = detectProps(source);

  entries.push({
    sourceFile: rel,
    fileName: path.basename(file),
    kind,
    classification,
    clientDirective,
    serverDirective,
    exports,
    hooks,
    jsxReferences,
    propTypes,
    imports,
    internalImports,
    thirdPartyImports,
    flags: {
      usesSuspense: /\bSuspense\b/.test(source),
      usesDynamicImport: /\bimport\s*\(/.test(source) || /\bdynamic\s*\(/.test(source),
      usesReactLazy: /\bReact\.lazy\s*\(/.test(source) || /\blazy\s*\(/.test(source),
      createsContext: /\bcreateContext\s*\(/.test(source),
      providesContext: /<[^>]*Provider\b/.test(source),
      usesPortal: /\bcreatePortal\s*\(/.test(source),
      usesMemoization: /\buseMemo\s*\(/.test(source) || /\buseCallback\s*\(/.test(source) || /\bmemo\s*\(/.test(source),
    }
  });
}

const byFile = new Map(entries.map((entry) => [entry.sourceFile, entry]));
for (const entry of entries) entry.importedBy = [];

for (const importer of entries) {
  for (const imported of importer.internalImports) {
    if (byFile.has(imported.resolved)) {
      byFile.get(imported.resolved).importedBy.push(importer.sourceFile);
    }
  }
}

for (const entry of entries) {
  entry.importedBy = [...new Set(entry.importedBy)].sort();
  entry.isLikelyOrphan =
    entry.kind === "shared-component" &&
    entry.importedBy.length === 0 &&
    !/\/index\.(tsx|jsx|ts|js)$/.test(entry.sourceFile);
}

const summary = {
  componentFiles: entries.length,
  pages: entries.filter((e) => e.kind === "page").length,
  layouts: entries.filter((e) => e.kind === "layout").length,
  sharedComponents: entries.filter((e) => e.kind === "shared-component").length,
  clientComponents: entries.filter((e) => e.classification === "client").length,
  serverDefaultComponents: entries.filter((e) => e.classification === "server-default").length,
  suspenseUsers: entries.filter((e) => e.flags.usesSuspense).length,
  dynamicImportUsers: entries.filter((e) => e.flags.usesDynamicImport).length,
  contextCreators: entries.filter((e) => e.flags.createsContext).length,
  likelyOrphans: entries.filter((e) => e.isLikelyOrphan).length,
};

const manifest = {
  generatedAt: new Date().toISOString(),
  scanRoots: scanRoots.map((p) => toPosix(path.relative(root, p))),
  summary,
  components: entries
};

function esc(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const registry = [
  "# Generated Component Registry",
  "",
  "> Generated by ATLAS-02D. Do not hand-edit this file; update component source and rerun `pnpm atlas:components`.",
  "",
  `Generated: ${manifest.generatedAt}`,
  "",
  "## Summary",
  "",
  `- Component-like files: ${summary.componentFiles}`,
  `- Pages: ${summary.pages}`,
  `- Layouts: ${summary.layouts}`,
  `- Shared components: ${summary.sharedComponents}`,
  `- Client components: ${summary.clientComponents}`,
  `- Server-default components: ${summary.serverDefaultComponents}`,
  `- Suspense users: ${summary.suspenseUsers}`,
  `- Dynamic-import users: ${summary.dynamicImportUsers}`,
  `- Context creators: ${summary.contextCreators}`,
  `- Likely orphan candidates: ${summary.likelyOrphans}`,
  "",
  "## Component inventory",
  "",
  "| Source | Kind | Runtime | Imports | Imported by | Hooks | Props | Orphan candidate |",
  "|---|---|---|---:|---:|---:|---:|---:|",
  ...entries.map((e) =>
    `| \`${esc(e.sourceFile)}\` | ${esc(e.kind)} | ${esc(e.classification)} | ` +
    `${e.internalImports.length} | ${e.importedBy.length} | ${e.hooks.length} | ${e.propTypes.length} | ` +
    `${e.isLikelyOrphan ? "Yes" : "No"} |`
  ),
  "",
  "## Likely orphan candidates",
  "",
  ...(entries.filter((e) => e.isLikelyOrphan).length
    ? entries.filter((e) => e.isLikelyOrphan).map((e) => `- \`${e.sourceFile}\``)
    : ["- None detected"]),
  "",
].join("\n");

const report = [
  "# ATLAS Component Intelligence Report",
  "",
  `Generated at ${manifest.generatedAt}.`,
  "",
  "## Inventory totals",
  "",
  "| Metric | Count |",
  "|---|---:|",
  `| Component-like files | ${summary.componentFiles} |`,
  `| Pages | ${summary.pages} |`,
  `| Layouts | ${summary.layouts} |`,
  `| Shared components | ${summary.sharedComponents} |`,
  `| Client components | ${summary.clientComponents} |`,
  `| Server-default components | ${summary.serverDefaultComponents} |`,
  `| Suspense users | ${summary.suspenseUsers} |`,
  `| Dynamic-import users | ${summary.dynamicImportUsers} |`,
  `| Context creators | ${summary.contextCreators} |`,
  `| Likely orphan candidates | ${summary.likelyOrphans} |`,
  "",
  "## Highest fan-in components",
  "",
  ...entries
    .slice()
    .sort((a, b) => b.importedBy.length - a.importedBy.length)
    .slice(0, 25)
    .map((e) => `- \`${e.sourceFile}\` — imported by ${e.importedBy.length} component files`),
  "",
  "## Largest hook users",
  "",
  ...entries
    .filter((e) => e.hooks.length)
    .slice()
    .sort((a, b) => b.hooks.length - a.hooks.length)
    .slice(0, 25)
    .map((e) => `- \`${e.sourceFile}\` — ${e.hooks.length} distinct hooks`),
  "",
  "## Notes",
  "",
  "- Runtime classification is based on explicit directives and Next.js server-by-default conventions.",
  "- Import resolution is static and covers relative imports plus the `@/` alias.",
  "- Orphan detection is heuristic and should be manually reviewed before deleting code.",
  "- JSX references are recorded for later ATLAS dependency-graph work.",
  "",
].join("\n");

const outputDir = path.join(root, "tools", "atlas", "output");
const governanceDir = path.join(root, "governance");
const reportsDir = path.join(root, "docs", "reports");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(governanceDir, { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });

fs.writeFileSync(
  path.join(outputDir, "component-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8"
);
fs.writeFileSync(
  path.join(governanceDir, "COMPONENT_REGISTRY.generated.md"),
  registry,
  "utf8"
);
fs.writeFileSync(
  path.join(reportsDir, "ATLAS-COMPONENT-INTELLIGENCE.md"),
  report,
  "utf8"
);

console.log("ATLAS-02D component intelligence complete.");
console.log(`Component-like files: ${summary.componentFiles}`);
console.log(`Pages: ${summary.pages}`);
console.log(`Shared components: ${summary.sharedComponents}`);
console.log(`Client components: ${summary.clientComponents}`);
console.log(`Likely orphan candidates: ${summary.likelyOrphans}`);
console.log("Manifest: tools/atlas/output/component-manifest.json");
console.log("Registry: governance/COMPONENT_REGISTRY.generated.md");
console.log("Report: docs/reports/ATLAS-COMPONENT-INTELLIGENCE.md");
