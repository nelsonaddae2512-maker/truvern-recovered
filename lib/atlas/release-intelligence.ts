import "server-only";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type AtlasReleaseNode = {
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

type AtlasEdge = {
  source: string;
  target: string;
  type?: string;
};

type AtlasGraph = {
  nodes: AtlasReleaseNode[];
  edges: AtlasEdge[];
  overlays?: {
    cycles?: string[][];
    featureCoupling?: Array<Record<string, unknown>>;
  };
};

type AtlasSnapshot = {
  schemaVersion: number;
  name: string;
  createdAt: string;
  graphHash: string;
  summary: {
    nodes: number;
    edges: number;
    cycles: number;
    featureCoupling: number;
  };
  graph: AtlasGraph;
};

export type AtlasReleaseDiff = {
  generatedAt: string;
  baseline: {
    name: string;
    createdAt: string;
    graphHash: string;
    summary: AtlasSnapshot["summary"];
  };
  current: {
    graphHash: string;
    summary: AtlasSnapshot["summary"];
  };
  readiness: "READY" | "CAUTION" | "REVIEW_REQUIRED" | "BLOCKED";
  riskScore: number;
  summary: {
    addedNodes: number;
    removedNodes: number;
    changedNodes: number;
    addedEdges: number;
    removedEdges: number;
    newCycles: number;
    resolvedCycles: number;
    affectedFeatures: number;
    highImpactChanges: number;
  };
  addedNodes: AtlasReleaseNode[];
  removedNodes: AtlasReleaseNode[];
  changedNodes: Array<{
    id: string;
    before: AtlasReleaseNode;
    after: AtlasReleaseNode;
    impactDelta: number;
  }>;
  addedEdges: AtlasEdge[];
  removedEdges: AtlasEdge[];
  newCycles: string[][];
  resolvedCycles: string[][];
  affectedFeatures: string[];
  highImpactChanges: AtlasReleaseNode[];
  checklist: string[];
};

const repoRoot = process.cwd();
const graphPath = path.join(
  repoRoot,
  "tools",
  "atlas",
  "output",
  "explorer-graph.json",
);
const snapshotDir = path.join(repoRoot, "tools", "atlas", "snapshots");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function hash(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function nodeSignature(node: AtlasReleaseNode): string {
  return hash({
    id: node.id,
    key: node.key,
    label: node.label,
    type: node.type,
    features: [...(node.features ?? [])].sort(),
    impact: node.impact ?? null,
    metadata: node.metadata ?? {},
  });
}

function edgeKey(edge: AtlasEdge): string {
  return `${edge.source}::${edge.type ?? "depends_on"}::${edge.target}`;
}

function cycleKey(cycle: string[]): string {
  return [...cycle].sort().join("::");
}

export function listAtlasReleaseSnapshots() {
  fs.mkdirSync(snapshotDir, { recursive: true });

  return fs
    .readdirSync(snapshotDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse()
    .map((file) => {
      const snapshot = readJson<AtlasSnapshot>(path.join(snapshotDir, file));

      return {
        file,
        name: snapshot.name,
        createdAt: snapshot.createdAt,
        graphHash: snapshot.graphHash,
        summary: snapshot.summary,
      };
    });
}

function resolveBaseline(file?: string): string {
  const snapshots = listAtlasReleaseSnapshots();

  if (file) {
    const candidate = path.join(snapshotDir, path.basename(file));
    if (!fs.existsSync(candidate)) {
      throw new Error("Requested ATLAS baseline snapshot does not exist.");
    }
    return candidate;
  }

  if (!snapshots.length) {
    throw new Error("No ATLAS release snapshots are available.");
  }

  return path.join(snapshotDir, snapshots[0]!.file);
}

export function compareAtlasRelease(
  baselineSnapshot: AtlasSnapshot,
  currentGraph: AtlasGraph,
): AtlasReleaseDiff {
  const baselineNodes = new Map(
    baselineSnapshot.graph.nodes.map((node) => [node.id, node]),
  );
  const currentNodes = new Map(currentGraph.nodes.map((node) => [node.id, node]));

  const addedNodes: AtlasReleaseNode[] = [];
  const removedNodes: AtlasReleaseNode[] = [];
  const changedNodes: AtlasReleaseDiff["changedNodes"] = [];

  for (const [id, node] of currentNodes) {
    const prior = baselineNodes.get(id);

    if (!prior) {
      addedNodes.push(node);
    } else if (nodeSignature(prior) !== nodeSignature(node)) {
      changedNodes.push({
        id,
        before: prior,
        after: node,
        impactDelta:
          Number(node.impact?.score ?? 0) -
          Number(prior.impact?.score ?? 0),
      });
    }
  }

  for (const [id, node] of baselineNodes) {
    if (!currentNodes.has(id)) {
      removedNodes.push(node);
    }
  }

  const baselineEdges = new Map(
    baselineSnapshot.graph.edges.map((edge) => [edgeKey(edge), edge]),
  );
  const currentEdges = new Map(
    currentGraph.edges.map((edge) => [edgeKey(edge), edge]),
  );

  const addedEdges = [...currentEdges]
    .filter(([key]) => !baselineEdges.has(key))
    .map(([, edge]) => edge);
  const removedEdges = [...baselineEdges]
    .filter(([key]) => !currentEdges.has(key))
    .map(([, edge]) => edge);

  const baselineCycles = new Map(
    (baselineSnapshot.graph.overlays?.cycles ?? []).map((cycle) => [
      cycleKey(cycle),
      cycle,
    ]),
  );
  const currentCycles = new Map(
    (currentGraph.overlays?.cycles ?? []).map((cycle) => [
      cycleKey(cycle),
      cycle,
    ]),
  );

  const newCycles = [...currentCycles]
    .filter(([key]) => !baselineCycles.has(key))
    .map(([, cycle]) => cycle);
  const resolvedCycles = [...baselineCycles]
    .filter(([key]) => !currentCycles.has(key))
    .map(([, cycle]) => cycle);

  const affectedFeatures = [
    ...new Set([
      ...addedNodes.flatMap((node) => node.features ?? []),
      ...removedNodes.flatMap((node) => node.features ?? []),
      ...changedNodes.flatMap((change) => [
        ...(change.before.features ?? []),
        ...(change.after.features ?? []),
      ]),
    ]),
  ].sort();

  const highImpactChanges = [
    ...addedNodes,
    ...removedNodes,
    ...changedNodes.map((change) => change.after),
  ]
    .filter((node) => Number(node.impact?.score ?? 0) >= 50)
    .sort(
      (a, b) =>
        Number(b.impact?.score ?? 0) -
        Number(a.impact?.score ?? 0),
    );

  let riskScore = 0;
  riskScore += addedNodes.length;
  riskScore += removedNodes.length * 3;
  riskScore += changedNodes.length * 2;
  riskScore += addedEdges.length * 0.5;
  riskScore += removedEdges.length;
  riskScore += newCycles.length * 8;
  riskScore -= resolvedCycles.length * 2;
  riskScore += highImpactChanges.length * 5;
  riskScore = Math.max(0, Math.round(riskScore));

  const readiness =
    riskScore >= 80
      ? "BLOCKED"
      : riskScore >= 40
        ? "REVIEW_REQUIRED"
        : riskScore >= 15
          ? "CAUTION"
          : "READY";

  const checklist: string[] = [];

  if (removedNodes.length) {
    checklist.push(
      "Verify that removed architecture assets have no runtime callers.",
    );
  }
  if (removedEdges.length) {
    checklist.push(
      "Validate removed dependency paths and related fallback behavior.",
    );
  }
  if (newCycles.length) {
    checklist.push(
      "Resolve or formally accept every newly introduced dependency cycle.",
    );
  }
  if (highImpactChanges.length) {
    checklist.push(
      "Run regression tests for every high-impact changed architecture asset.",
    );
  }
  if (affectedFeatures.length) {
    checklist.push(
      "Complete feature-level validation for all affected features.",
    );
  }
  if (!checklist.length) {
    checklist.push("Confirm smoke tests and deployment checks before release.");
  }

  return {
    generatedAt: new Date().toISOString(),
    baseline: {
      name: baselineSnapshot.name,
      createdAt: baselineSnapshot.createdAt,
      graphHash: baselineSnapshot.graphHash,
      summary: baselineSnapshot.summary,
    },
    current: {
      graphHash: hash(currentGraph),
      summary: {
        nodes: currentGraph.nodes.length,
        edges: currentGraph.edges.length,
        cycles: currentGraph.overlays?.cycles?.length ?? 0,
        featureCoupling:
          currentGraph.overlays?.featureCoupling?.length ?? 0,
      },
    },
    readiness,
    riskScore,
    summary: {
      addedNodes: addedNodes.length,
      removedNodes: removedNodes.length,
      changedNodes: changedNodes.length,
      addedEdges: addedEdges.length,
      removedEdges: removedEdges.length,
      newCycles: newCycles.length,
      resolvedCycles: resolvedCycles.length,
      affectedFeatures: affectedFeatures.length,
      highImpactChanges: highImpactChanges.length,
    },
    addedNodes,
    removedNodes,
    changedNodes,
    addedEdges,
    removedEdges,
    newCycles,
    resolvedCycles,
    affectedFeatures,
    highImpactChanges,
    checklist,
  };
}

export function getAtlasReleaseDiff(baselineFile?: string): AtlasReleaseDiff {
  if (!fs.existsSync(graphPath)) {
    throw new Error("ATLAS explorer graph is unavailable.");
  }

  const baseline = readJson<AtlasSnapshot>(resolveBaseline(baselineFile));
  const current = readJson<AtlasGraph>(graphPath);

  return compareAtlasRelease(baseline, current);
}
