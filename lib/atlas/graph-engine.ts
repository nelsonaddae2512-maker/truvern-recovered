import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export type AtlasGraphNode = {
  id: string;
  key: string;
  type: string;
  label: string;
  layer: number;
  metadata: Record<string, unknown>;
  features: string[];
  impact: {
    score: number;
    directDependencyCount: number;
    directDependentCount: number;
    forwardBlastRadiusCount: number;
    reverseBlastRadiusCount: number;
    affectedFeatures: string[];
  } | null;
};

export type AtlasGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: string;
  metadata: Record<string, unknown>;
};

export type AtlasExplorerGraph = {
  generatedAt: string;
  version: string;
  summary: Record<string, number>;
  nodes: AtlasGraphNode[];
  edges: AtlasGraphEdge[];
  overlays: {
    cycles: string[][];
    featureCoupling: Array<Record<string, unknown>>;
  };
};

const graphPath = path.join(
  process.cwd(),
  "tools",
  "atlas",
  "output",
  "explorer-graph.json",
);

export async function loadAtlasExplorerGraph(): Promise<AtlasExplorerGraph> {
  const raw = await readFile(graphPath, "utf8");
  return JSON.parse(raw) as AtlasExplorerGraph;
}

export function filterAtlasGraph(
  graph: AtlasExplorerGraph,
  options: {
    q?: string;
    type?: string;
    feature?: string;
    limit?: number;
    includeEdges?: boolean;
    includeOverlays?: boolean;
  },
): AtlasExplorerGraph {
  const q = options.q?.trim().toLowerCase();
  const type = options.type?.trim().toLowerCase();
  const feature = options.feature?.trim().toLowerCase();
  const limit = Math.max(1, Math.min(options.limit ?? 500, 5000));

  const nodes = graph.nodes
    .filter((node) => {
      if (type && node.type.toLowerCase() !== type) return false;
      if (
        feature &&
        !node.features.some((item) => item.toLowerCase().includes(feature)) &&
        !(node.type === "feature" && node.id.toLowerCase().includes(feature))
      ) {
        return false;
      }
      if (!q) return true;

      const haystack = [
        node.id,
        node.label,
        node.type,
        JSON.stringify(node.metadata),
        ...node.features,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    })
    .slice(0, limit);

  const ids = new Set(nodes.map((node) => node.id));
  const edges = options.includeEdges === false
    ? []
    : graph.edges.filter(
        (edge) => ids.has(edge.source) && ids.has(edge.target),
      );

  return {
    ...graph,
    summary: {
      ...graph.summary,
      filteredNodes: nodes.length,
      filteredEdges: edges.length,
    },
    nodes,
    edges,
    overlays: options.includeOverlays === false
      ? { cycles: [], featureCoupling: [] }
      : graph.overlays,
  };
}
