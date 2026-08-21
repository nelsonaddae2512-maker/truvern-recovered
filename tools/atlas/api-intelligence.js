const fs = require("fs");
const path = require("path");

const root = process.cwd();
const apiRoot = path.join(root, "app", "api");

if (!fs.existsSync(apiRoot)) {
  console.error(`API root not found: ${apiRoot}`);
  process.exit(1);
}

const routeFileNames = new Set(["route.ts", "route.tsx", "route.js", "route.jsx"]);
const methodNames = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (routeFileNames.has(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function routePathFromFile(file) {
  const rel = toPosix(path.relative(path.join(root, "app"), file));
  const withoutRoute = rel.replace(/\/route\.(ts|tsx|js|jsx)$/, "");
  return "/" + withoutRoute.replace(/^api\//, "api/");
}

function dynamicParams(routePath) {
  const params = [];
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(routePath))) {
    params.push(m[1].replace(/^\.\.\./, ""));
  }
  return params;
}

function detectMethods(source) {
  const found = new Set();

  for (const method of methodNames) {
    const patterns = [
      new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`),
      new RegExp(`export\\s+const\\s+${method}\\s*=`),
      new RegExp(`export\\s*\\{[^}]*\\b${method}\\b[^}]*\\}`)
    ];
    if (patterns.some((pattern) => pattern.test(source))) found.add(method);
  }

  return [...found];
}

function detectImports(source) {
  const imports = [];
  const regex = /import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["'];?|import\s+["']([^"']+)["'];?/g;
  let m;
  while ((m = regex.exec(source))) {
    imports.push(m[1] || m[2]);
  }
  return [...new Set(imports)].sort();
}

function detectPrismaModels(source) {
  const names = new Set();
  const regexes = [
    /\bprisma\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
    /\btx\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
  ];
  for (const regex of regexes) {
    let m;
    while ((m = regex.exec(source))) {
      const name = m[1];
      if (!["$transaction", "$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe"].includes(name)) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

function includesAny(source, patterns) {
  return patterns.some((p) => typeof p === "string" ? source.includes(p) : p.test(source));
}

function scoreRoute(flags) {
  let score = 0;
  const reasons = [];

  if (flags.hasAuth) {
    score += 30;
  } else {
    reasons.push("No authentication indicator detected");
  }

  if (flags.hasValidation) {
    score += 20;
  } else {
    reasons.push("No input validation indicator detected");
  }

  if (flags.hasErrorHandling) {
    score += 20;
  } else {
    reasons.push("No explicit error handling detected");
  }

  if (flags.hasStructuredResponse) {
    score += 15;
  } else {
    reasons.push("No structured response helper detected");
  }

  if (flags.hasAuthorization) {
    score += 15;
  } else {
    reasons.push("No authorization/tenancy indicator detected");
  }

  return { score, reasons };
}

const files = walk(apiRoot).sort();
const routes = files.map((file) => {
  const source = fs.readFileSync(file, "utf8");
  const rel = toPosix(path.relative(root, file));
  const routePath = routePathFromFile(file);
  const methods = detectMethods(source);
  const imports = detectImports(source);
  const prismaModels = detectPrismaModels(source);

  const flags = {
    hasAuth: includesAny(source, [
      /(?:await\s+)?auth\s*\(/,
      /currentUser\s*\(/,
      /getAuth\s*\(/,
      /require[A-Z][A-Za-z0-9_]*\s*\(/,
      /clerk/i,
      /session/i,
    ]),
    hasAuthorization: includesAny(source, [
      /organizationId/,
      /orgId/,
      /tenant/i,
      /membership/i,
      /role/i,
      /permission/i,
      /authorize/i,
      /assert[A-Z]/,
    ]),
    hasValidation: includesAny(source, [
      /\.parse\s*\(/,
      /\.safeParse\s*\(/,
      /\bzod\b/i,
      /\bvalidate[A-Z_a-z0-9]*\s*\(/,
      /schema\s*\./,
    ]),
    hasErrorHandling: includesAny(source, [
      /try\s*\{/,
      /catch\s*\(/,
      /catch\s*\{/,
      /throw\s+new\s+/,
    ]),
    hasStructuredResponse: includesAny(source, [
      /NextResponse\.json\s*\(/,
      /Response\.json\s*\(/,
      /new\s+NextResponse\s*\(/,
      /return\s+json\s*\(/,
    ]),
    usesPrisma: includesAny(source, [
      /\bprisma\./,
      /\btx\./,
      /@prisma\/client/,
    ]),
    usesRawSql: includesAny(source, [
      /\$queryRaw/,
      /\$executeRaw/,
      /\$queryRawUnsafe/,
      /\$executeRawUnsafe/,
    ]),
    usesWebhookVerification: includesAny(source, [
      /svix/i,
      /webhook/i,
      /signature/i,
    ]),
  };

  const governance = scoreRoute(flags);

  return {
    routePath,
    sourceFile: rel,
    methods,
    dynamicParameters: dynamicParams(routePath),
    imports,
    prismaModels,
    flags,
    governance,
  };
});

const summary = {
  routeFiles: routes.length,
  endpoints: routes.reduce((sum, r) => sum + Math.max(r.methods.length, 1), 0),
  authenticatedRoutes: routes.filter((r) => r.flags.hasAuth).length,
  authorizedRoutes: routes.filter((r) => r.flags.hasAuthorization).length,
  validatedRoutes: routes.filter((r) => r.flags.hasValidation).length,
  prismaRoutes: routes.filter((r) => r.flags.usesPrisma).length,
  rawSqlRoutes: routes.filter((r) => r.flags.usesRawSql).length,
  routesNeedingReview: routes.filter((r) => r.governance.score < 70).length,
};

const manifest = {
  generatedAt: new Date().toISOString(),
  apiRoot: toPosix(path.relative(root, apiRoot)),
  summary,
  routes,
};

function esc(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

const registry = [
  "# Generated API Registry",
  "",
  "> Generated by ATLAS-02C. Do not hand-edit this file; update the route source and rerun `pnpm atlas:api`.",
  "",
  `Generated: ${manifest.generatedAt}`,
  "",
  "## Summary",
  "",
  `- Route files: ${summary.routeFiles}`,
  `- Endpoint-method combinations: ${summary.endpoints}`,
  `- Authentication indicators: ${summary.authenticatedRoutes}`,
  `- Authorization/tenancy indicators: ${summary.authorizedRoutes}`,
  `- Validation indicators: ${summary.validatedRoutes}`,
  `- Prisma-using routes: ${summary.prismaRoutes}`,
  `- Raw SQL routes: ${summary.rawSqlRoutes}`,
  `- Routes scoring below 70: ${summary.routesNeedingReview}`,
  "",
  "## Route inventory",
  "",
  "| Route | Methods | Auth | Authorization | Validation | Prisma | Raw SQL | Score | Source |",
  "|---|---|---:|---:|---:|---:|---:|---:|---|",
  ...routes.map((r) =>
    `| ${esc(r.routePath)} | ${esc(r.methods.join(", ") || "Undetected")} | ` +
    `${r.flags.hasAuth ? "Yes" : "No"} | ${r.flags.hasAuthorization ? "Yes" : "No"} | ` +
    `${r.flags.hasValidation ? "Yes" : "No"} | ${r.flags.usesPrisma ? "Yes" : "No"} | ` +
    `${r.flags.usesRawSql ? "Yes" : "No"} | ${r.governance.score} | \`${esc(r.sourceFile)}\` |`
  ),
  "",
  "## Route details",
  "",
  ...routes.flatMap((r) => [
    `### ${r.routePath}`,
    "",
    `- Source: \`${r.sourceFile}\``,
    `- Methods: ${r.methods.length ? r.methods.join(", ") : "No exported method detected"}`,
    `- Dynamic parameters: ${r.dynamicParameters.length ? r.dynamicParameters.join(", ") : "None"}`,
    `- Prisma models: ${r.prismaModels.length ? r.prismaModels.join(", ") : "None detected"}`,
    `- Governance score: ${r.governance.score}/100`,
    ...(r.governance.reasons.length
      ? ["- Review flags:", ...r.governance.reasons.map((reason) => `  - ${reason}`)]
      : ["- Review flags: None"]),
    "",
  ]),
  "",
].join("\n");

const report = [
  "# ATLAS API Intelligence Report",
  "",
  `Generated from \`${manifest.apiRoot}\` at ${manifest.generatedAt}.`,
  "",
  "## Inventory totals",
  "",
  "| Metric | Count |",
  "|---|---:|",
  `| Route files | ${summary.routeFiles} |`,
  `| Endpoint-method combinations | ${summary.endpoints} |`,
  `| Routes with auth indicators | ${summary.authenticatedRoutes} |`,
  `| Routes with authorization/tenancy indicators | ${summary.authorizedRoutes} |`,
  `| Routes with validation indicators | ${summary.validatedRoutes} |`,
  `| Routes using Prisma | ${summary.prismaRoutes} |`,
  `| Routes using raw SQL | ${summary.rawSqlRoutes} |`,
  `| Routes scoring below 70 | ${summary.routesNeedingReview} |`,
  "",
  "## Governance score distribution",
  "",
  "| Band | Routes |",
  "|---|---:|",
  `| 90-100 | ${routes.filter((r) => r.governance.score >= 90).length} |`,
  `| 70-89 | ${routes.filter((r) => r.governance.score >= 70 && r.governance.score < 90).length} |`,
  `| 50-69 | ${routes.filter((r) => r.governance.score >= 50 && r.governance.score < 70).length} |`,
  `| Below 50 | ${routes.filter((r) => r.governance.score < 50).length} |`,
  "",
  "## Review candidates",
  "",
  ...(routes.filter((r) => r.governance.score < 70).length
    ? routes
        .filter((r) => r.governance.score < 70)
        .map((r) => `- \`${r.routePath}\` (${r.governance.score}/100) — ${r.governance.reasons.join("; ")}`)
    : ["- None"]),
  "",
  "## Notes",
  "",
  "- Indicators are static heuristics, not a substitute for a security review.",
  "- Authentication and authorization may be enforced indirectly through shared helpers or middleware.",
  "- The manifest preserves imports and Prisma model references for later dependency-graph milestones.",
  "",
].join("\n");

const outputDir = path.join(root, "tools", "atlas", "output");
const governanceDir = path.join(root, "governance");
const reportsDir = path.join(root, "docs", "reports");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(governanceDir, { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });

fs.writeFileSync(
  path.join(outputDir, "api-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8"
);
fs.writeFileSync(
  path.join(governanceDir, "API_REGISTRY.generated.md"),
  registry,
  "utf8"
);
fs.writeFileSync(
  path.join(reportsDir, "ATLAS-API-INTELLIGENCE.md"),
  report,
  "utf8"
);

console.log("ATLAS-02C API intelligence complete.");
console.log(`Route files: ${summary.routeFiles}`);
console.log(`Endpoint-method combinations: ${summary.endpoints}`);
console.log(`Authenticated route indicators: ${summary.authenticatedRoutes}`);
console.log(`Routes using Prisma: ${summary.prismaRoutes}`);
console.log(`Routes needing review: ${summary.routesNeedingReview}`);
console.log("Manifest: tools/atlas/output/api-manifest.json");
console.log("Registry: governance/API_REGISTRY.generated.md");
console.log("Report: docs/reports/ATLAS-API-INTELLIGENCE.md");
