#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tools", "atlas", "output");
const REPORTS_DIR = path.join(ROOT, "docs", "reports");
const IGNORE_DIRS = new Set([
  ".git", ".next", "node_modules", "coverage", "dist", "build", "out",
  ".turbo", ".vercel", "Truvern-Backups", "backups"
]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ALL_EXTENSIONS = new Set([...SOURCE_EXTENSIONS, ".prisma", ".json", ".md", ".css", ".scss", ".sql", ".ps1", ".yml", ".yaml"]);

function toPosix(value) { return value.split(path.sep).join("/"); }
function relative(file) { return toPosix(path.relative(ROOT, file)); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function readText(file) { try { return fs.readFileSync(file, "utf8"); } catch { return ""; } }
function lineCount(text) { return text ? text.split(/\r?\n/).length : 0; }
function uniqueSorted(values) { return [...new Set(values)].sort((a,b)=>a.localeCompare(b)); }

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function routeFromFile(rel) {
  const normalized = rel.replace(/^app\//, "").replace(/\/(page|layout|loading|error|not-found|template|default)\.(tsx?|jsx?)$/, "");
  const withoutGroups = normalized.split("/").filter(part => !(part.startsWith("(") && part.endsWith(")"))).join("/");
  return "/" + withoutGroups.replace(/\/index$/, "");
}

function classify(file, rel, text) {
  const base = path.basename(file);
  const ext = path.extname(file).toLowerCase();
  const categories = [];
  if (/^app\/api\/.+\/route\.(ts|js)$/.test(rel)) categories.push("api-route");
  if (/^app\/.+\/page\.(tsx?|jsx?)$/.test(rel) || /^app\/page\.(tsx?|jsx?)$/.test(rel)) categories.push("page");
  if (/^app\/.+\/layout\.(tsx?|jsx?)$/.test(rel) || /^app\/layout\.(tsx?|jsx?)$/.test(rel)) categories.push("layout");
  if (/^components\//.test(rel)) categories.push("component");
  if (/^lib\//.test(rel)) categories.push("library");
  if (/^scripts\//.test(rel)) categories.push("script");
  if (/^tests?\//.test(rel) || /\.(test|spec)\.(tsx?|jsx?)$/.test(rel)) categories.push("test");
  if (/middleware\.(ts|js)$/.test(rel)) categories.push("middleware");
  if (ext === ".prisma") categories.push("prisma");
  if (base === "package.json") categories.push("package-manifest");
  if (base.startsWith(".env") || /env/i.test(base)) categories.push("environment");
  if (SOURCE_EXTENSIONS.has(ext)) categories.push(text.match(/^\s*["']use client["'];?/m) ? "client-module" : "server-or-shared-module");
  return uniqueSorted(categories);
}

function exportedSymbols(text) {
  const symbols = [];
  const patterns = [
    /export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /export\s+(?:const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
    /export\s*\{([^}]+)\}/g
  ];
  let match;
  while ((match = patterns[0].exec(text))) symbols.push(match[1]);
  while ((match = patterns[1].exec(text))) symbols.push(match[1]);
  while ((match = patterns[2].exec(text))) {
    for (const item of match[1].split(",")) {
      const name = item.trim().split(/\s+as\s+/i).pop();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) symbols.push(name);
    }
  }
  return uniqueSorted(symbols);
}

function imports(text) {
  const result = [];
  const patterns = [/from\s+["']([^"']+)["']/g, /import\s*["']([^"']+)["']/g, /require\(\s*["']([^"']+)["']\s*\)/g];
  for (const pattern of patterns) { let m; while ((m = pattern.exec(text))) result.push(m[1]); }
  return uniqueSorted(result);
}

function httpMethods(text) {
  const methods = [];
  for (const method of ["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"]) {
    if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b|export\\s+const\\s+${method}\\b`).test(text)) methods.push(method);
  }
  return methods;
}

function markdownTable(headers, rows) {
  const esc = v => String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  return `| ${headers.map(esc).join(" | ")} |\n| ${headers.map(()=>"---").join(" | ")} |\n` + rows.map(row => `| ${row.map(esc).join(" | ")} |`).join("\n");
}

const allFiles = walk(ROOT).filter(file => ALL_EXTENSIONS.has(path.extname(file).toLowerCase()) || path.basename(file).startsWith(".env"));
const records = allFiles.map(file => {
  const rel = relative(file);
  const text = readText(file);
  const stat = fs.statSync(file);
  const categories = classify(file, rel, text);
  const route = categories.includes("page") ? routeFromFile(rel) : null;
  const apiRoute = categories.includes("api-route") ? "/" + rel.replace(/^app\//, "").replace(/\/route\.(ts|js)$/, "") : null;
  return {
    path: rel,
    extension: path.extname(file).toLowerCase() || null,
    sizeBytes: stat.size,
    lines: lineCount(text),
    categories,
    route,
    apiRoute,
    httpMethods: categories.includes("api-route") ? httpMethods(text) : [],
    imports: SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase()) ? imports(text) : [],
    exports: SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase()) ? exportedSymbols(text) : [],
    sha256: sha256(text)
  };
}).sort((a,b)=>a.path.localeCompare(b.path));

const categoryCounts = {};
for (const record of records) for (const category of record.categories) categoryCounts[category] = (categoryCounts[category] || 0) + 1;
const topLevel = {};
for (const record of records) { const key = record.path.split("/")[0]; topLevel[key] = (topLevel[key] || 0) + 1; }

const manifest = {
  schemaVersion: "1.0.0",
  generator: "ATLAS-02A Repository Scanner",
  generatedAt: new Date().toISOString(),
  repositoryRoot: toPosix(ROOT),
  summary: {
    filesScanned: records.length,
    totalLines: records.reduce((sum,r)=>sum+r.lines,0),
    totalBytes: records.reduce((sum,r)=>sum+r.sizeBytes,0),
    categoryCounts,
    topLevelCounts: topLevel
  },
  files: records
};

ensureDir(OUTPUT_DIR); ensureDir(REPORTS_DIR);
fs.writeFileSync(path.join(OUTPUT_DIR, "repository-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

const generated = manifest.generatedAt;
const summaryRows = Object.entries(categoryCounts).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>[k,v]);
const moduleRows = Object.entries(topLevel).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>[k,v]);
const apiRows = records.filter(r=>r.apiRoute).map(r=>[r.apiRoute,r.httpMethods.join(", ") || "Undetected",r.path,r.lines]);
const pageRows = records.filter(r=>r.route).map(r=>[r.route,r.path,r.categories.includes("client-module")?"Client":"Server/shared",r.lines]);

const report = `# ATLAS Repository Inventory\n\nGenerated: ${generated}\n\n> Generated by ATLAS-02A. Do not hand-edit generated sections.\n\n## Summary\n\n- Files scanned: ${manifest.summary.filesScanned}\n- Total lines: ${manifest.summary.totalLines}\n- Total bytes: ${manifest.summary.totalBytes}\n\n## Classification counts\n\n${markdownTable(["Classification","Count"],summaryRows)}\n\n## Top-level modules\n\n${markdownTable(["Module","Files"],moduleRows)}\n\n## Application pages\n\n${pageRows.length ? markdownTable(["Route","Source","Runtime classification","Lines"],pageRows) : "No pages detected."}\n\n## API routes\n\n${apiRows.length ? markdownTable(["Route","Methods","Source","Lines"],apiRows) : "No API routes detected."}\n\n## Machine-readable manifest\n\nSee \`tools/atlas/output/repository-manifest.json\`.\n`;
fs.writeFileSync(path.join(REPORTS_DIR, "ATLAS-REPOSITORY-INVENTORY.md"), report, "utf8");

const moduleRegistry = `# Module Registry\n\nGenerated: ${generated}\n\n> Generated by ATLAS-02A.\n\n${markdownTable(["Top-level module","Inventory files"],moduleRows)}\n\nDetailed records are in \`tools/atlas/output/repository-manifest.json\`.\n`;
fs.writeFileSync(path.join(ROOT, "governance", "MODULE_REGISTRY.generated.md"), moduleRegistry, "utf8");

console.log("ATLAS-02A repository scan complete.");
console.log(`Files scanned: ${manifest.summary.filesScanned}`);
console.log(`Manifest: ${relative(path.join(OUTPUT_DIR, "repository-manifest.json"))}`);
console.log(`Report: ${relative(path.join(REPORTS_DIR, "ATLAS-REPOSITORY-INVENTORY.md"))}`);
