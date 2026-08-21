#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function loadGraph(repoRoot = process.cwd()) {
  const graphPath = path.join(
    repoRoot,
    "tools",
    "atlas",
    "output",
    "explorer-graph.json",
  );

  if (!fs.existsSync(graphPath)) {
    throw new Error(
      `ATLAS explorer graph not found at ${graphPath}. Run pnpm atlas:graph first.`,
    );
  }

  return JSON.parse(fs.readFileSync(graphPath, "utf8"));
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function scoreNode(node, queryTokens) {
  const fields = [
    node.id,
    node.key,
    node.label,
    node.type,
    ...(node.features || []),
    JSON.stringify(node.metadata || {}),
  ].map(normalize);

  let score = 0;
  for (const token of queryTokens) {
    if (fields[0].includes(token)) score += 8;
    if (fields[1].includes(token)) score += 7;
    if (fields[2].includes(token)) score += 6;
    if (fields[3] === token) score += 5;
    if (fields[4]?.includes(token)) score += 4;
    if (fields.some((field) => field.includes(token))) score += 1;
  }

  if ((node.impact?.score || 0) > 0) {
    score += Math.min(3, Number(node.impact.score) / 100);
  }

  return score;
}

function makeIndexes(graph) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = new Map();
  const incoming = new Map();

  for (const edge of graph.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target]);
    incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge.source]);
  }

  return { nodeById, outgoing, incoming };
}

function traverse(startId, adjacency, limit = 500) {
  const visited = new Set();
  const queue = [startId];

  while (queue.length && visited.size < limit) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) || []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  return visited;
}

function classifyIntent(question) {
  const value = normalize(question);

  if (/\b(change|modify|edit|remove|rename|break|impact|blast|affected)\b/.test(value)) {
    return "impact";
  }
  if (/\b(dependents|used by|uses this|downstream|callers)\b/.test(value)) {
    return "dependents";
  }
  if (/\b(dependencies|depends on|upstream|imports|calls)\b/.test(value)) {
    return "dependencies";
  }
  if (/\b(cycle|circular)\b/.test(value)) {
    return "cycles";
  }
  if (/\b(hotspot|critical|bottleneck|choke)\b/.test(value)) {
    return "hotspots";
  }
  if (/\b(feature|implemented|where is|find|locate|show)\b/.test(value)) {
    return "search";
  }

  return "search";
}

function summarizeNode(node) {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    features: node.features || [],
    impactScore: node.impact?.score || 0,
    metadata: node.metadata || {},
  };
}

function answerArchitectureQuestion(graph, question) {
  const queryTokens = tokens(question);
  const intent = classifyIntent(question);
  const { nodeById, outgoing, incoming } = makeIndexes(graph);

  const matches = graph.nodes
    .map((node) => ({ node, score: scoreNode(node, queryTokens) }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.node.impact?.score || 0) - (a.node.impact?.score || 0),
    )
    .slice(0, 12);

  if (intent === "cycles") {
    const cycles = (graph.overlays?.cycles || []).slice(0, 20);
    return {
      intent,
      question,
      answer: `ATLAS detected ${graph.overlays?.cycles?.length || 0} cycle candidates. The first ${cycles.length} are included below for inspection.`,
      confidence: 1,
      primaryNode: null,
      nodes: [],
      related: [],
      affectedFeatures: [],
      counts: {
        cycles: graph.overlays?.cycles?.length || 0,
      },
      evidence: cycles.map((cycle, index) => ({
        label: `Cycle ${index + 1}`,
        value: cycle.join(" → "),
      })),
      suggestions: [
        "Inspect the cycle with the highest-impact nodes first.",
        "Move shared contracts into a lower-level module.",
        "Replace bidirectional imports with an interface or event boundary.",
      ],
    };
  }

  if (intent === "hotspots") {
    const hotspots = graph.nodes
      .filter((node) => (node.impact?.score || 0) > 0)
      .sort((a, b) => (b.impact?.score || 0) - (a.impact?.score || 0))
      .slice(0, 20);

    return {
      intent,
      question,
      answer: `The highest-impact architecture assets are ranked below. These should receive additional testing and review before change.`,
      confidence: 1,
      primaryNode: hotspots[0] ? summarizeNode(hotspots[0]) : null,
      nodes: hotspots.map(summarizeNode),
      related: [],
      affectedFeatures: [
        ...new Set(hotspots.flatMap((node) => node.features || [])),
      ],
      counts: {
        hotspots: hotspots.length,
      },
      evidence: hotspots.map((node) => ({
        label: node.label,
        value: `${node.type} · impact ${node.impact?.score || 0}`,
      })),
      suggestions: [
        "Start with the top-ranked node.",
        "Review its direct dependents before implementation.",
        "Add regression coverage around every affected feature.",
      ],
    };
  }

  if (!matches.length) {
    return {
      intent,
      question,
      answer:
        "ATLAS could not find a strong architecture match. Try using an exact file, component, API, Prisma model, or feature name.",
      confidence: 0,
      primaryNode: null,
      nodes: [],
      related: [],
      affectedFeatures: [],
      counts: {},
      evidence: [],
      suggestions: [
        "Use an exact identifier such as EvidenceRequest.",
        "Include a route path such as /api/evidence-requests.",
        "Ask where a named feature is implemented.",
      ],
    };
  }

  const primary = matches[0].node;
  const directDependencies = (outgoing.get(primary.id) || [])
    .map((id) => nodeById.get(id))
    .filter(Boolean);
  const directDependents = (incoming.get(primary.id) || [])
    .map((id) => nodeById.get(id))
    .filter(Boolean);

  let relatedIds = new Set();
  let answer = "";

  if (intent === "dependencies") {
    relatedIds = traverse(primary.id, outgoing);
    relatedIds.delete(primary.id);
    answer = `${primary.label} has ${directDependencies.length} direct dependencies and ${relatedIds.size} reachable upstream architecture assets.`;
  } else if (intent === "dependents") {
    relatedIds = traverse(primary.id, incoming);
    relatedIds.delete(primary.id);
    answer = `${primary.label} has ${directDependents.length} direct dependents and ${relatedIds.size} reachable downstream architecture assets.`;
  } else if (intent === "impact") {
    const upstream = traverse(primary.id, outgoing);
    const downstream = traverse(primary.id, incoming);
    relatedIds = new Set([...upstream, ...downstream]);
    relatedIds.delete(primary.id);
    answer = `Changing ${primary.label} could expose ${relatedIds.size} connected architecture assets across ${new Set([...relatedIds].flatMap((id) => nodeById.get(id)?.features || [])).size} features.`;
  } else {
    relatedIds = new Set([
      ...(outgoing.get(primary.id) || []),
      ...(incoming.get(primary.id) || []),
    ]);
    answer = `The strongest architecture match is ${primary.label} (${primary.type}). ${matches.length} relevant assets were found.`;
  }

  const related = [...relatedIds]
    .map((id) => nodeById.get(id))
    .filter(Boolean)
    .sort(
      (a, b) =>
        (b.impact?.score || 0) - (a.impact?.score || 0) ||
        a.label.localeCompare(b.label),
    )
    .slice(0, 50);

  const affectedFeatures = [
    ...new Set([
      ...(primary.features || []),
      ...related.flatMap((node) => node.features || []),
    ]),
  ];

  const confidence = Math.min(1, matches[0].score / Math.max(8, queryTokens.length * 7));

  return {
    intent,
    question,
    answer,
    confidence,
    primaryNode: summarizeNode(primary),
    nodes: matches.map(({ node }) => summarizeNode(node)),
    related: related.map(summarizeNode),
    affectedFeatures,
    counts: {
      directDependencies: directDependencies.length,
      directDependents: directDependents.length,
      related: relatedIds.size,
      affectedFeatures: affectedFeatures.length,
    },
    evidence: [
      {
        label: "Primary match",
        value: `${primary.id} · ${primary.type}`,
      },
      {
        label: "Impact score",
        value: String(primary.impact?.score || 0),
      },
      {
        label: "Direct dependencies",
        value: String(directDependencies.length),
      },
      {
        label: "Direct dependents",
        value: String(directDependents.length),
      },
    ],
    suggestions:
      intent === "impact"
        ? [
            "Review direct dependents before changing the selected asset.",
            "Test every affected feature listed by ATLAS.",
            "Inspect high-impact related nodes before merging.",
          ]
        : [
            "Open the primary node in the Architecture Explorer.",
            "Inspect direct dependencies and dependents.",
            "Use a more exact identifier to narrow the result.",
          ],
  };
}

function main() {
  const args = process.argv.slice(2);
  const graph = loadGraph();

  if (args.includes("--self-test")) {
    const tests = [
      "Where is vendor onboarding implemented?",
      "What depends on EvidenceRequest?",
      "What changes if I modify the Vendor model?",
      "Show architecture hotspots",
      "Show dependency cycles",
    ];

    for (const question of tests) {
      const result = answerArchitectureQuestion(graph, question);
      if (!result || typeof result.answer !== "string") {
        throw new Error(`Assistant self-test failed for: ${question}`);
      }
    }

    console.log("ATLAS-04A assistant self-test passed.");
    console.log(`Graph nodes: ${graph.nodes.length}`);
    console.log(`Graph edges: ${graph.edges.length}`);
    return;
  }

  const question = args.filter((arg) => !arg.startsWith("--")).join(" ").trim();
  if (!question) {
    console.log('Usage: pnpm atlas:ask -- "What depends on EvidenceRequest?"');
    process.exitCode = 1;
    return;
  }

  const result = answerArchitectureQuestion(graph, question);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  answerArchitectureQuestion,
  classifyIntent,
  loadGraph,
};

if (require.main === module) {
  main();
}
