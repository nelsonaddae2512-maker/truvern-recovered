import "server-only";

import fs from "node:fs";
import path from "node:path";

export type AtlasAssistantNode = {
  id: string;
  label: string;
  type: string;
  features: string[];
  impactScore: number;
  metadata: Record<string, unknown>;
};

export type AtlasAssistantResult = {
  intent: string;
  question: string;
  answer: string;
  confidence: number;
  primaryNode: AtlasAssistantNode | null;
  nodes: AtlasAssistantNode[];
  related: AtlasAssistantNode[];
  affectedFeatures: string[];
  counts: Record<string, number>;
  evidence: Array<{ label: string; value: string }>;
  suggestions: string[];
};

type RawNode = {
  id: string;
  key: string;
  type: string;
  label: string;
  metadata: Record<string, unknown>;
  features: string[];
  impact: {
    score: number;
  } | null;
};

type RawEdge = {
  source: string;
  target: string;
};

type RawGraph = {
  nodes: RawNode[];
  edges: RawEdge[];
  overlays: {
    cycles: string[][];
    featureCoupling: Array<Record<string, unknown>>;
  };
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function loadGraph(): RawGraph {
  const graphPath = path.join(
    process.cwd(),
    "tools",
    "atlas",
    "output",
    "explorer-graph.json",
  );

  if (!fs.existsSync(graphPath)) {
    throw new Error("ATLAS explorer graph is unavailable. Run pnpm atlas:graph.");
  }

  return JSON.parse(fs.readFileSync(graphPath, "utf8")) as RawGraph;
}

function classifyIntent(question: string):
  | "impact"
  | "dependents"
  | "dependencies"
  | "cycles"
  | "hotspots"
  | "search" {
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
  if (/\b(cycle|circular)\b/.test(value)) return "cycles";
  if (/\b(hotspot|critical|bottleneck|choke)\b/.test(value)) return "hotspots";
  return "search";
}

function scoreNode(node: RawNode, queryTokens: string[]): number {
  const fields = [
    node.id,
    node.key,
    node.label,
    node.type,
    ...(node.features ?? []),
    JSON.stringify(node.metadata ?? {}),
  ].map(normalize);

  let score = 0;

  for (const token of queryTokens) {
    if (fields[0]?.includes(token)) score += 8;
    if (fields[1]?.includes(token)) score += 7;
    if (fields[2]?.includes(token)) score += 6;
    if (fields[3] === token) score += 5;
    if (fields[4]?.includes(token)) score += 4;
    if (fields.some((field) => field.includes(token))) score += 1;
  }

  if ((node.impact?.score ?? 0) > 0) {
    score += Math.min(3, (node.impact?.score ?? 0) / 100);
  }

  return score;
}

function summarizeNode(node: RawNode): AtlasAssistantNode {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    features: node.features ?? [],
    impactScore: node.impact?.score ?? 0,
    metadata: node.metadata ?? {},
  };
}

function traverse(
  startId: string,
  adjacency: Map<string, string[]>,
  limit = 500,
): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length && visited.size < limit) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  return visited;
}

export function answerAtlasQuestion(question: string): AtlasAssistantResult {
  const graph = loadGraph();
  const intent = classifyIntent(question);
  const queryTokens = tokenize(question);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const edge of graph.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  }

  if (intent === "cycles") {
    const cycles = graph.overlays?.cycles ?? [];
    return {
      intent,
      question,
      answer: `ATLAS detected ${cycles.length} dependency-cycle candidates.`,
      confidence: 1,
      primaryNode: null,
      nodes: [],
      related: [],
      affectedFeatures: [],
      counts: { cycles: cycles.length },
      evidence: cycles.slice(0, 20).map((cycle, index) => ({
        label: `Cycle ${index + 1}`,
        value: cycle.join(" → "),
      })),
      suggestions: [
        "Inspect the highest-impact nodes in each cycle.",
        "Move shared contracts into a lower-level module.",
        "Replace bidirectional imports with an interface boundary.",
      ],
    };
  }

  if (intent === "hotspots") {
    const hotspots = graph.nodes
      .filter((node) => (node.impact?.score ?? 0) > 0)
      .sort((a, b) => (b.impact?.score ?? 0) - (a.impact?.score ?? 0))
      .slice(0, 20);

    return {
      intent,
      question,
      answer:
        "ATLAS ranked the highest-impact architecture assets. These deserve additional testing and review before change.",
      confidence: 1,
      primaryNode: hotspots[0] ? summarizeNode(hotspots[0]) : null,
      nodes: hotspots.map(summarizeNode),
      related: [],
      affectedFeatures: [
        ...new Set(hotspots.flatMap((node) => node.features ?? [])),
      ],
      counts: { hotspots: hotspots.length },
      evidence: hotspots.map((node) => ({
        label: node.label,
        value: `${node.type} · impact ${node.impact?.score ?? 0}`,
      })),
      suggestions: [
        "Start with the top-ranked node.",
        "Review its direct dependents.",
        "Add regression coverage for affected features.",
      ],
    };
  }

  const matches = graph.nodes
    .map((node) => ({ node, score: scoreNode(node, queryTokens) }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.node.impact?.score ?? 0) - (a.node.impact?.score ?? 0),
    )
    .slice(0, 12);

  if (!matches.length) {
    return {
      intent,
      question,
      answer:
        "ATLAS could not find a strong architecture match. Use an exact file, component, API, Prisma model, or feature name.",
      confidence: 0,
      primaryNode: null,
      nodes: [],
      related: [],
      affectedFeatures: [],
      counts: {},
      evidence: [],
      suggestions: [
        "Use an identifier such as EvidenceRequest.",
        "Include an API route path.",
        "Ask where a named feature is implemented.",
      ],
    };
  }

  const primary = matches[0]!.node;
  const directDependencies = (outgoing.get(primary.id) ?? [])
    .map((id) => nodeById.get(id))
    .filter((node): node is RawNode => Boolean(node));
  const directDependents = (incoming.get(primary.id) ?? [])
    .map((id) => nodeById.get(id))
    .filter((node): node is RawNode => Boolean(node));

  let relatedIds = new Set<string>();
  let answer: string;

  if (intent === "dependencies") {
    relatedIds = traverse(primary.id, outgoing);
    relatedIds.delete(primary.id);
    answer = `${primary.label} has ${directDependencies.length} direct dependencies and ${relatedIds.size} reachable upstream assets.`;
  } else if (intent === "dependents") {
    relatedIds = traverse(primary.id, incoming);
    relatedIds.delete(primary.id);
    answer = `${primary.label} has ${directDependents.length} direct dependents and ${relatedIds.size} reachable downstream assets.`;
  } else if (intent === "impact") {
    const upstream = traverse(primary.id, outgoing);
    const downstream = traverse(primary.id, incoming);
    relatedIds = new Set([...upstream, ...downstream]);
    relatedIds.delete(primary.id);
    answer = `Changing ${primary.label} could expose ${relatedIds.size} connected architecture assets.`;
  } else {
    relatedIds = new Set([
      ...(outgoing.get(primary.id) ?? []),
      ...(incoming.get(primary.id) ?? []),
    ]);
    answer = `The strongest architecture match is ${primary.label} (${primary.type}).`;
  }

  const related = [...relatedIds]
    .map((id) => nodeById.get(id))
    .filter((node): node is RawNode => Boolean(node))
    .sort(
      (a, b) =>
        (b.impact?.score ?? 0) - (a.impact?.score ?? 0) ||
        a.label.localeCompare(b.label),
    )
    .slice(0, 50);

  const affectedFeatures = [
    ...new Set([
      ...(primary.features ?? []),
      ...related.flatMap((node) => node.features ?? []),
    ]),
  ];

  return {
    intent,
    question,
    answer,
    confidence: Math.min(
      1,
      matches[0]!.score / Math.max(8, queryTokens.length * 7),
    ),
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
      { label: "Primary match", value: `${primary.id} · ${primary.type}` },
      { label: "Impact score", value: String(primary.impact?.score ?? 0) },
      {
        label: "Direct dependencies",
        value: String(directDependencies.length),
      },
      { label: "Direct dependents", value: String(directDependents.length) },
    ],
    suggestions:
      intent === "impact"
        ? [
            "Review direct dependents before changing this asset.",
            "Test every affected feature listed by ATLAS.",
            "Inspect high-impact related nodes before merging.",
          ]
        : [
            "Open the primary node in Architecture Explorer.",
            "Inspect direct dependencies and dependents.",
            "Use a more exact identifier to narrow the result.",
          ],
  };
}
