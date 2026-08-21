const fs = require("fs");
const path = require("path");

const root = process.cwd();
const outputDir = path.join(root, "tools", "atlas", "output");
const graphPath = path.join(outputDir, "dependency-graph.json");
const impactPath = path.join(outputDir, "impact-index.json");
const catalogPath = path.join(outputDir, "query-catalog.json");
const guidePath = path.join(root, "governance", "ARCHITECTURE_QUERY_GUIDE.generated.md");
const reportPath = path.join(root, "docs", "reports", "ATLAS-ARCHITECTURE-QUERY-ENGINE.md");

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function ensureInputs() {
  const graph = readJson(graphPath);
  const impact = readJson(impactPath);
  if (!graph || !impact) {
    console.error("ATLAS dependency artifacts are missing.");
    console.error("Run `pnpm atlas:impact` before using ATLAS-03A.");
    process.exit(1);
  }
  return { graph, impact };
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function parseArgs(argv) {
  const json = argv.includes("--json");
  const compact = argv.includes("--compact");
  const filtered = argv.filter((x) => x !== "--json" && x !== "--compact");
  return { args: filtered, json, compact };
}

function buildIndexes(graph, impact) {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map();
  const incoming = new Map();

  for (const node of graph.nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }

  for (const edge of graph.edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    outgoing.get(edge.from).push(edge);
    incoming.get(edge.to).push(edge);
  }

  const aliases = new Map();
  for (const node of graph.nodes) {
    const values = [
      node.id,
      node.label,
      node.metadata?.sourceFile,
      node.metadata?.routePath,
      node.metadata?.kind
    ].filter(Boolean);

    for (const value of values) {
      const key = normalize(value);
      if (!aliases.has(key)) aliases.set(key, []);
      aliases.get(key).push(node.id);
    }
  }

  return {
    nodeById,
    outgoing,
    incoming,
    aliases,
    impactAssets: impact.assets || {},
    rankedAssetIds: impact.rankedAssetIds || []
  };
}

function resolveNode(query, indexes) {
  const q = normalize(query);
  if (!q) return { node: null, matches: [] };

  if (indexes.nodeById.has(query)) {
    return { node: indexes.nodeById.get(query), matches: [query] };
  }

  const exact = indexes.aliases.get(q) || [];
  if (exact.length === 1) {
    return { node: indexes.nodeById.get(exact[0]), matches: exact };
  }

  const matches = [...indexes.nodeById.values()]
    .filter((node) => {
      const haystack = [
        node.id,
        node.label,
        node.type,
        node.metadata?.sourceFile,
        node.metadata?.routePath,
        node.metadata?.kind
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => {
      const aExact = normalize(a.label) === q || normalize(a.id) === q ? 1 : 0;
      const bExact = normalize(b.label) === q || normalize(b.id) === q ? 1 : 0;
      return bExact - aExact || a.label.localeCompare(b.label);
    });

  return {
    node: matches.length === 1 ? matches[0] : null,
    matches: matches.map((x) => x.id)
  };
}

function display(data, json, compact = false) {
  if (json) {
    console.log(JSON.stringify(data, null, compact ? 0 : 2));
    return;
  }
  return false;
}

function printNode(node) {
  console.log(`${node.id}`);
  console.log(`  Type: ${node.type}`);
  console.log(`  Label: ${node.label}`);
  const metadata = node.metadata || {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) continue;
    console.log(`  ${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
  }
}

function listMatches(matches, indexes, limit = 50) {
  const rows = matches.slice(0, limit).map((id) => indexes.nodeById.get(id)).filter(Boolean);
  for (const node of rows) {
    console.log(`- ${node.id} — ${node.label}`);
  }
  if (matches.length > limit) console.log(`...and ${matches.length - limit} more`);
}

function requireResolved(query, indexes) {
  const resolved = resolveNode(query, indexes);
  if (resolved.node) return resolved.node;

  if (!resolved.matches.length) {
    console.error(`No architecture node matched: ${query}`);
    process.exitCode = 1;
    return null;
  }

  console.error(`Query is ambiguous. ${resolved.matches.length} nodes matched:`);
  listMatches(resolved.matches, indexes, 30);
  console.error("Use the full node ID shown above.");
  process.exitCode = 1;
  return null;
}

function buildCatalog(graph, impact, indexes) {
  const byType = {};
  for (const node of graph.nodes) {
    if (!byType[node.type]) byType[node.type] = [];
    byType[node.type].push({
      id: node.id,
      label: node.label,
      metadata: node.metadata || {}
    });
  }

  for (const list of Object.values(byType)) {
    list.sort((a, b) => a.label.localeCompare(b.label));
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    summary: graph.summary,
    commands: [
      "search <term>",
      "inspect <node>",
      "dependencies <node>",
      "dependents <node>",
      "impact <node>",
      "feature <feature-id-or-name>",
      "hotspots [limit]",
      "cycles [limit]",
      "coupling [limit]",
      "types",
      "build",
      "self-test"
    ],
    nodeTypes: Object.fromEntries(
      Object.entries(byType).map(([type, items]) => [type, { count: items.length, items }])
    ),
    topHotspots: indexes.rankedAssetIds.slice(0, 100).map((id) => impact.assets[id]).filter(Boolean)
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.dirname(guidePath), { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");

  const guide = [
    "# Generated ATLAS Architecture Query Guide",
    "",
    "> Generated by ATLAS-03A. Rerun `pnpm atlas:query build` after regenerating ATLAS architecture manifests.",
    "",
    `Generated: ${catalog.generatedAt}`,
    "",
    "## Commands",
    "",
    "```powershell",
    'pnpm atlas:query search "ReviewAssignment"',
    'pnpm atlas:query inspect "model:ReviewAssignment"',
    'pnpm atlas:query dependencies "feature:truvern-review"',
    'pnpm atlas:query dependents "model:EvidenceRequest"',
    'pnpm atlas:query impact "model:ReviewAssignment"',
    'pnpm atlas:query feature "truvern-review"',
    "pnpm atlas:query hotspots 20",
    "pnpm atlas:query cycles 25",
    "pnpm atlas:query coupling 20",
    "```",
    "",
    "Add `--json` for machine-readable output.",
    "",
    "## Node types",
    "",
    "| Type | Count |",
    "|---|---:|",
    ...Object.entries(byType)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, items]) => `| ${type} | ${items.length} |`),
    "",
    "## Top architectural hotspots",
    "",
    "| Rank | Node | Type | Impact score |",
    "|---:|---|---|---:|",
    ...catalog.topHotspots.slice(0, 50).map((item, index) =>
      `| ${index + 1} | \`${String(item.id).replace(/\|/g, "\\|")}\` | ${item.type} | ${item.score} |`
    ),
    ""
  ].join("\n");

  const report = [
    "# ATLAS Architecture Query Engine",
    "",
    `Generated at ${catalog.generatedAt}.`,
    "",
    "## Purpose",
    "",
    "ATLAS-03A exposes the architecture graph as a command-line query surface for development, debugging, review planning, and future automation.",
    "",
    "## Available operations",
    "",
    "- Search nodes by name, path, type, route, or feature.",
    "- Inspect node metadata.",
    "- Traverse forward dependencies.",
    "- Traverse reverse dependents.",
    "- Calculate blast radius and affected features.",
    "- Inspect all assets belonging to a business feature.",
    "- Rank hotspots by architectural impact.",
    "- Review cycle candidates and cross-feature coupling.",
    "- Export results as JSON.",
    "",
    "## Catalog summary",
    "",
    `- Total nodes: ${graph.summary.nodes}`,
    `- Total edges: ${graph.summary.edges}`,
    `- Node types: ${Object.keys(byType).length}`,
    `- Indexed hotspots: ${catalog.topHotspots.length}`,
    ""
  ].join("\n");

  fs.writeFileSync(guidePath, guide, "utf8");
  fs.writeFileSync(reportPath, report, "utf8");
  return catalog;
}

function main() {
  const { args, json, compact } = parseArgs(process.argv.slice(2));
  const command = args[0] || "help";
  const rest = args.slice(1);
  const { graph, impact } = ensureInputs();
  const indexes = buildIndexes(graph, impact);

  if (command === "help" || command === "--help" || command === "-h") {
    const help = {
      title: "ATLAS Architecture Query Engine",
      usage: [
        'pnpm atlas:query search "<term>"',
        'pnpm atlas:query inspect "<node-id-or-term>"',
        'pnpm atlas:query dependencies "<node>"',
        'pnpm atlas:query dependents "<node>"',
        'pnpm atlas:query impact "<node>"',
        'pnpm atlas:query feature "<feature-id-or-name>"',
        "pnpm atlas:query hotspots [limit]",
        "pnpm atlas:query cycles [limit]",
        "pnpm atlas:query coupling [limit]",
        "pnpm atlas:query types",
        "pnpm atlas:query build",
        "pnpm atlas:query self-test"
      ],
      flags: ["--json", "--compact"]
    };
    if (display(help, json, compact) === false) {
      console.log(help.title);
      console.log("");
      console.log("Usage:");
      for (const line of help.usage) console.log(`  ${line}`);
      console.log("");
      console.log("Flags:");
      console.log("  --json     Machine-readable output");
      console.log("  --compact  Compact JSON output");
    }
    return;
  }

  if (command === "build") {
    const catalog = buildCatalog(graph, impact, indexes);
    if (display(catalog, json, compact) === false) {
      console.log("ATLAS-03A query catalog built.");
      console.log(`Nodes indexed: ${graph.nodes.length}`);
      console.log(`Catalog: tools/atlas/output/query-catalog.json`);
      console.log(`Guide: governance/ARCHITECTURE_QUERY_GUIDE.generated.md`);
      console.log(`Report: docs/reports/ATLAS-ARCHITECTURE-QUERY-ENGINE.md`);
    }
    return;
  }

  if (command === "types") {
    const counts = {};
    for (const node of graph.nodes) counts[node.type] = (counts[node.type] || 0) + 1;
    if (display(counts, json, compact) === false) {
      for (const [type, count] of Object.entries(counts).sort()) {
        console.log(`${type}: ${count}`);
      }
    }
    return;
  }

  if (command === "search") {
    const query = rest.join(" ").trim();
    const resolved = resolveNode(query, indexes);
    const rows = resolved.matches.map((id) => indexes.nodeById.get(id)).filter(Boolean);
    if (display(rows, json, compact) === false) {
      console.log(`Matches: ${rows.length}`);
      listMatches(resolved.matches, indexes, 100);
    }
    return;
  }

  if (["inspect", "dependencies", "dependents", "impact"].includes(command)) {
    const query = rest.join(" ").trim();
    const node = requireResolved(query, indexes);
    if (!node) return;

    if (command === "inspect") {
      const result = {
        node,
        directDependencies: (indexes.outgoing.get(node.id) || []).map((e) => ({
          kind: e.kind,
          node: indexes.nodeById.get(e.to)
        })),
        directDependents: (indexes.incoming.get(node.id) || []).map((e) => ({
          kind: e.kind,
          node: indexes.nodeById.get(e.from)
        })),
        impact: indexes.impactAssets[node.id] || null
      };
      if (display(result, json, compact) === false) {
        printNode(node);
        console.log(`  Direct dependencies: ${result.directDependencies.length}`);
        console.log(`  Direct dependents: ${result.directDependents.length}`);
        console.log(`  Impact score: ${result.impact?.score ?? 0}`);
      }
      return;
    }

    if (command === "dependencies" || command === "dependents") {
      const edges = command === "dependencies"
        ? (indexes.outgoing.get(node.id) || []).map((e) => ({ kind: e.kind, node: indexes.nodeById.get(e.to) }))
        : (indexes.incoming.get(node.id) || []).map((e) => ({ kind: e.kind, node: indexes.nodeById.get(e.from) }));

      if (display({ source: node, relationships: edges }, json, compact) === false) {
        console.log(`${command === "dependencies" ? "Dependencies" : "Dependents"} of ${node.id}: ${edges.length}`);
        for (const item of edges) {
          console.log(`- [${item.kind}] ${item.node?.id || "unknown"} — ${item.node?.label || "unknown"}`);
        }
      }
      return;
    }

    const result = indexes.impactAssets[node.id] || {
      id: node.id,
      type: node.type,
      label: node.label,
      score: 0,
      directDependencies: [],
      directDependents: [],
      forwardBlastRadius: [],
      reverseBlastRadius: [],
      affectedFeatures: []
    };

    if (display(result, json, compact) === false) {
      console.log(`Impact analysis: ${node.id}`);
      console.log(`  Impact score: ${result.score}`);
      console.log(`  Direct dependencies: ${result.directDependencies.length}`);
      console.log(`  Direct dependents: ${result.directDependents.length}`);
      console.log(`  Forward blast radius: ${result.forwardBlastRadius.length}`);
      console.log(`  Reverse blast radius: ${result.reverseBlastRadius.length}`);
      console.log(`  Affected features: ${result.affectedFeatures.length ? result.affectedFeatures.join(", ") : "None detected"}`);
      if (result.reverseBlastRadius.length) {
        console.log("");
        console.log("Top reverse-impact nodes:");
        for (const item of result.reverseBlastRadius.slice(0, 25)) {
          const related = indexes.nodeById.get(item.id);
          console.log(`- depth ${item.depth}: ${related?.id || item.id} via ${item.via}`);
        }
      }
    }
    return;
  }

  if (command === "feature") {
    const query = rest.join(" ").trim();
    const candidates = graph.nodes.filter((n) =>
      n.type === "feature" &&
      (normalize(n.id).includes(normalize(query)) || normalize(n.label).includes(normalize(query)))
    );

    if (candidates.length !== 1) {
      if (!candidates.length) console.error(`No feature matched: ${query}`);
      else {
        console.error(`Feature query is ambiguous. ${candidates.length} matched:`);
        for (const item of candidates) console.error(`- ${item.id} — ${item.label}`);
      }
      process.exitCode = 1;
      return;
    }

    const feature = candidates[0];
    const assets = (indexes.outgoing.get(feature.id) || [])
      .filter((e) => e.kind === "contains")
      .map((e) => indexes.nodeById.get(e.to))
      .filter(Boolean)
      .sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));

    const dependencies = (indexes.outgoing.get(feature.id) || [])
      .filter((e) => e.kind === "depends-on-feature")
      .map((e) => indexes.nodeById.get(e.to))
      .filter(Boolean);

    const result = { feature, assets, featureDependencies: dependencies };
    if (display(result, json, compact) === false) {
      printNode(feature);
      console.log(`  Assets: ${assets.length}`);
      console.log(`  Feature dependencies: ${dependencies.length}`);
      const grouped = {};
      for (const asset of assets) {
        if (!grouped[asset.type]) grouped[asset.type] = [];
        grouped[asset.type].push(asset);
      }
      for (const [type, items] of Object.entries(grouped)) {
        console.log("");
        console.log(`${type.toUpperCase()} (${items.length})`);
        for (const item of items.slice(0, 50)) console.log(`- ${item.id}`);
        if (items.length > 50) console.log(`...and ${items.length - 50} more`);
      }
    }
    return;
  }

  if (command === "hotspots") {
    const limit = Math.max(1, Math.min(500, Number(rest[0]) || 25));
    const rows = indexes.rankedAssetIds.slice(0, limit).map((id) => indexes.impactAssets[id]).filter(Boolean);
    if (display(rows, json, compact) === false) {
      rows.forEach((item, index) => {
        console.log(`${index + 1}. ${item.id} — score ${item.score}; reverse radius ${item.reverseBlastRadius.length}; features ${item.affectedFeatures.length}`);
      });
    }
    return;
  }

  if (command === "cycles") {
    const limit = Math.max(1, Math.min(500, Number(rest[0]) || 25));
    const rows = (graph.cycles || []).slice(0, limit);
    if (display(rows, json, compact) === false) {
      console.log(`Cycle candidates shown: ${rows.length} of ${(graph.cycles || []).length}`);
      rows.forEach((cycle, index) => console.log(`${index + 1}. ${cycle.join(" -> ")}`));
    }
    return;
  }

  if (command === "coupling") {
    const limit = Math.max(1, Math.min(500, Number(rest[0]) || 25));
    const rows = (graph.featureCoupling || [])
      .slice()
      .sort((a, b) => b.sharedAssetCount - a.sharedAssetCount)
      .slice(0, limit);
    if (display(rows, json, compact) === false) {
      rows.forEach((item, index) => {
        console.log(`${index + 1}. ${item.featureA} <-> ${item.featureB}: ${item.sharedAssetCount} shared assets`);
      });
    }
    return;
  }

  if (command === "self-test") {
    const assertions = [];
    function check(name, condition) {
      assertions.push({ name, passed: Boolean(condition) });
    }

    check("graph contains nodes", graph.nodes.length > 0);
    check("graph contains edges", graph.edges.length > 0);
    check("impact index contains assets", Object.keys(indexes.impactAssets).length > 0);
    check("feature nodes exist", graph.nodes.some((n) => n.type === "feature"));
    check("search resolves known node", resolveNode(graph.nodes[0].id, indexes).node?.id === graph.nodes[0].id);
    check("ranked hotspots exist", indexes.rankedAssetIds.length > 0);

    const failed = assertions.filter((x) => !x.passed);
    if (display({ passed: failed.length === 0, assertions }, json, compact) === false) {
      for (const item of assertions) {
        console.log(`${item.passed ? "PASS" : "FAIL"}: ${item.name}`);
      }
      console.log("");
      console.log(failed.length ? `Self-test failed: ${failed.length}` : "ATLAS-03A self-test passed.");
    }
    if (failed.length) process.exitCode = 1;
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run `pnpm atlas:query help`.");
  process.exitCode = 1;
}

main();
