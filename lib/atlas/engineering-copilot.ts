import "server-only";

import fs from "node:fs";
import path from "node:path";

export type CopilotAsset = {
  id: string;
  label: string;
  type: string;
  layer: string;
  file: string;
  features: string[];
  impactScore: number;
  matchScore?: number;
};

type AtlasGraphNode = {
  id: string;
  key?: string;
  label: string;
  type: string;
  features?: string[];
  impact?: {
    score?: number;
  } | null;
  metadata?: Record<string, unknown>;
};

type AtlasGraph = {
  nodes: AtlasGraphNode[];
  edges: Array<{
    source: string;
    target: string;
    type?: string;
  }>;
  overlays?: {
    cycles?: string[][];
  };
};

export type EngineeringPlan = {
  mode: "PLAN" | "REGRESSION";
  request: string;
  generatedAt: string;
  complexity: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  summary: string;
  targets: CopilotAsset[];
  related: CopilotAsset[];
  affectedFeatures: string[];
  sequence: Array<{
    step: number;
    layer: string;
    objective: string;
    assets: CopilotAsset[];
  }>;
  risks: string[];
  validation: string[];
  reviewerChecklist: string[];
  regressionAreas?: Array<{
    area: string;
    reason: string;
  }>;
};

export type DebtReport = {
  mode: "DEBT";
  generatedAt: string;
  summary: string;
  cycles: string[][];
  hotspots: CopilotAsset[];
  recommendations: string[];
};

const graphPath = path.join(
  process.cwd(),
  "tools",
  "atlas",
  "output",
  "explorer-graph.json",
);

function readGraph(): AtlasGraph {
  if (!fs.existsSync(graphPath)) {
    throw new Error("ATLAS explorer graph is unavailable.");
  }

  return JSON.parse(fs.readFileSync(graphPath, "utf8")) as AtlasGraph;
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return [
    ...new Set(
      normalize(value)
        .split(/\s+/)
        .filter((token) => token.length > 2),
    ),
  ];
}

function inferLayer(node: AtlasGraphNode): string {
  const value = `${node.type} ${node.id}`.toLowerCase();

  if (value.includes("prisma") || value.includes("model")) return "Data";
  if (value.includes("api") || value.includes("route")) return "API";
  if (value.includes("component")) return "UI";
  if (value.includes("page")) return "Page";
  if (value.includes("lib") || value.includes("service")) return "Domain";
  return "Supporting";
}

function probableFile(node: AtlasGraphNode): string {
  const metadata = node.metadata ?? {};
  const values = [
    metadata.file,
    metadata.path,
    metadata.filePath,
    metadata.source,
    node.id,
  ];

  const match = values.find(
    (value): value is string =>
      typeof value === "string" && value.includes("/"),
  );

  return match ?? node.id;
}

function nodeText(node: AtlasGraphNode): string {
  return normalize(
    [
      node.id,
      node.key,
      node.label,
      node.type,
      ...(node.features ?? []),
      JSON.stringify(node.metadata ?? {}),
    ].join(" "),
  );
}

function scoreNode(node: AtlasGraphNode, queryTokens: string[]): number {
  const text = nodeText(node);
  let score = 0;

  for (const token of queryTokens) {
    if (text.includes(token)) score += 8;
    if (normalize(node.label).includes(token)) score += 10;
    if (
      (node.features ?? []).some((feature) =>
        normalize(feature).includes(token),
      )
    ) {
      score += 12;
    }
  }

  score += Math.min(20, Number(node.impact?.score ?? 0) / 5);
  return score;
}

function toAsset(node: AtlasGraphNode, matchScore?: number): CopilotAsset {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    layer: inferLayer(node),
    file: probableFile(node),
    features: node.features ?? [],
    impactScore: Number(node.impact?.score ?? 0),
    ...(matchScore === undefined
      ? {}
      : { matchScore: Math.round(matchScore) }),
  };
}

function rankedTargets(
  graph: AtlasGraph,
  request: string,
  limit = 18,
): CopilotAsset[] {
  const queryTokens = tokens(request);

  return graph.nodes
    .map((node) => ({
      node,
      score: scoreNode(node, queryTokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => toAsset(entry.node, entry.score));
}

function dependentAssets(
  graph: AtlasGraph,
  selectedIds: string[],
): CopilotAsset[] {
  const selected = new Set(selectedIds);
  const related = new Set<string>();

  for (const edge of graph.edges) {
    if (selected.has(edge.source)) related.add(edge.target);
    if (selected.has(edge.target)) related.add(edge.source);
  }

  return graph.nodes
    .filter((node) => related.has(node.id) && !selected.has(node.id))
    .sort(
      (a, b) =>
        Number(b.impact?.score ?? 0) -
        Number(a.impact?.score ?? 0),
    )
    .slice(0, 20)
    .map((node) => toAsset(node));
}

export function createEngineeringPlan(
  request: string,
  mode: "PLAN" | "REGRESSION" = "PLAN",
): EngineeringPlan {
  const graph = readGraph();
  const targets = rankedTargets(graph, request);
  const related = dependentAssets(
    graph,
    targets.slice(0, 8).map((target) => target.id),
  );

  const layers = [...new Set(targets.map((target) => target.layer))];
  const affectedFeatures = [
    ...new Set([
      ...targets.flatMap((target) => target.features),
      ...related.flatMap((target) => target.features),
    ]),
  ].sort();

  const highestImpact = Math.max(
    0,
    ...targets.map((target) => target.impactScore),
    ...related.map((target) => target.impactScore),
  );

  const complexity: EngineeringPlan["complexity"] =
    targets.length >= 14 || layers.length >= 5 || highestImpact >= 80
      ? "HIGH"
      : targets.length >= 7 || layers.length >= 3 || highestImpact >= 45
        ? "MEDIUM"
        : "LOW";

  const sequence: EngineeringPlan["sequence"] = [];
  const layerOrder = ["Data", "Domain", "API", "UI", "Page", "Supporting"];

  for (const layer of layerOrder) {
    const matches = targets.filter((target) => target.layer === layer);
    if (!matches.length) continue;

    const objective =
      layer === "Data"
        ? "Confirm schema, persistence, and migration requirements."
        : layer === "Domain"
          ? "Implement core business rules and reusable services."
          : layer === "API"
            ? "Add or update server routes and validation."
            : layer === "UI"
              ? "Update interactive components and user feedback."
              : layer === "Page"
                ? "Wire the experience into the correct application route."
                : "Update supporting utilities, reports, or documentation.";

    sequence.push({
      step: sequence.length + 1,
      layer,
      objective,
      assets: matches.slice(0, 6),
    });
  }

  const validation = [
    "npx tsc --noEmit",
    "pnpm atlas:graph",
    "pnpm atlas:release-diff",
  ];

  if (layers.includes("Data")) {
    validation.unshift("pnpm prisma generate");
    validation.push(
      "Review migration safety before applying database changes.",
    );
  }
  if (layers.includes("API")) {
    validation.push(
      "Exercise affected API routes with success and failure cases.",
    );
  }
  if (layers.includes("UI") || layers.includes("Page")) {
    validation.push(
      "Run focused browser validation for the affected workflow.",
    );
  }

  const risks: string[] = [];

  if (highestImpact >= 50) {
    risks.push(
      "One or more matched assets have high architecture impact.",
    );
  }
  if (related.length >= 12) {
    risks.push(
      "The requested change has a broad dependency blast radius.",
    );
  }
  if (affectedFeatures.length >= 5) {
    risks.push(
      "Multiple product features may require regression testing.",
    );
  }
  if (!risks.length) {
    risks.push(
      "No exceptional architecture risk was detected from the current graph.",
    );
  }

  const result: EngineeringPlan = {
    mode,
    request,
    generatedAt: new Date().toISOString(),
    complexity,
    confidence: targets.length
      ? Math.min(0.96, 0.45 + targets.length * 0.035)
      : 0.2,
    summary:
      mode === "REGRESSION"
        ? `ATLAS identified ${affectedFeatures.length} feature areas and ${related.length} related architecture assets for regression review.`
        : targets.length
          ? `ATLAS identified ${targets.length} likely implementation assets across ${layers.length} architecture layers.`
          : "ATLAS did not find a strong architecture match. Refine the request with a feature, route, model, or workflow name.",
    targets,
    related,
    affectedFeatures,
    sequence,
    risks,
    validation,
    reviewerChecklist: [
      "Confirm the selected architecture assets match the intended business workflow.",
      "Create a repository checkpoint before implementation.",
      "Implement in dependency order rather than editing UI first.",
      "Run focused regression checks for every affected feature.",
      "Capture a new ATLAS snapshot after validation passes.",
    ],
  };

  if (mode === "REGRESSION") {
    result.regressionAreas = [
      ...affectedFeatures.map((feature) => ({
        area: feature,
        reason:
          "Feature is attached to a matched or dependent architecture asset.",
      })),
      ...related.slice(0, 8).map((node) => ({
        area: node.label,
        reason: `Related ${node.type} asset with impact score ${node.impactScore}.`,
      })),
    ];
  }

  return result;
}

export function createDebtReport(): DebtReport {
  const graph = readGraph();
  const cycles = graph.overlays?.cycles ?? [];

  const hotspots = [...graph.nodes]
    .sort(
      (a, b) =>
        Number(b.impact?.score ?? 0) -
        Number(a.impact?.score ?? 0),
    )
    .slice(0, 20)
    .map((node) => toAsset(node));

  return {
    mode: "DEBT",
    generatedAt: new Date().toISOString(),
    summary: `ATLAS detected ${cycles.length} dependency cycles and ranked ${hotspots.length} high-impact architecture hotspots.`,
    cycles: cycles.slice(0, 25),
    hotspots,
    recommendations: [
      "Prioritize cycles containing high-impact models, APIs, or shared services.",
      "Split large cross-feature utilities into narrower domain-owned modules.",
      "Reduce components that coordinate unrelated workflows.",
      "Track hotspot and cycle movement with ATLAS release snapshots.",
      "Require focused tests before changing any top-ranked hotspot.",
    ],
  };
}
