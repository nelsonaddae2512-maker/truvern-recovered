"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

type GraphNode = {
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

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: string;
  metadata: Record<string, unknown>;
};

type ExplorerGraph = {
  generatedAt: string;
  version: string;
  summary: Record<string, number>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  overlays: {
    cycles: string[][];
    featureCoupling: Array<Record<string, unknown>>;
  };
};

type Viewport = {
  x: number;
  y: number;
  scale: number;
};

type OverlayMode = "dependencies" | "dependents" | "blast" | "path";

const NODE_TYPES = ["all", "feature", "page", "component", "api", "model"];
const MIN_SCALE = 0.3;
const MAX_SCALE = 3.5;
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatMetadata(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function nodeTypeLabel(type: string): string {
  if (type === "api") return "API";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function buildLayeredPositions(nodes: GraphNode[]) {
  const width = 1400;
  const height = 860;
  const paddingX = 100;
  const paddingY = 80;
  const layers = new Map<number, GraphNode[]>();

  for (const node of nodes) {
    const layer = Number.isFinite(node.layer) ? node.layer : 99;
    const current = layers.get(layer) ?? [];
    current.push(node);
    layers.set(layer, current);
  }

  const orderedLayers = [...layers.keys()].sort((a, b) => a - b);
  const positions = new Map<string, { x: number; y: number }>();

  orderedLayers.forEach((layer, layerIndex) => {
    const layerNodes = (layers.get(layer) ?? []).slice(0, 90);
    const x =
      orderedLayers.length === 1
        ? width / 2
        : paddingX +
          (layerIndex * (width - paddingX * 2)) /
            Math.max(1, orderedLayers.length - 1);

    layerNodes.forEach((node, index) => {
      const y =
        layerNodes.length === 1
          ? height / 2
          : paddingY +
            (index * (height - paddingY * 2)) /
              Math.max(1, layerNodes.length - 1);
      positions.set(node.id, { x, y });
    });
  });

  return { width, height, positions };
}

function traverse(
  startId: string,
  adjacency: Map<string, string[]>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  return visited;
}

function shortestPath(
  source: string,
  target: string,
  adjacency: Map<string, string[]>,
): string[] {
  if (source === target) return [source];

  const queue = [source];
  const previous = new Map<string, string | null>([[source, null]]);

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;

    for (const next of adjacency.get(current) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, current);

      if (next === target) {
        const result = [target];
        let cursor: string | null = current;
        while (cursor) {
          result.unshift(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return result;
      }

      queue.push(next);
    }
  }

  return [];
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function RelationshipList({
  title,
  nodes,
  onSelect,
}: {
  title: string;
  nodes: GraphNode[];
  onSelect: (node: GraphNode) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-white">{title}</h3>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">
          {nodes.length}
        </span>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {nodes.length ? (
          nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node)}
              className="block w-full rounded-xl border border-white/5 bg-slate-950/45 px-3 py-2 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.06]"
            >
              <div className="truncate text-sm font-medium text-slate-100">
                {node.label}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">
                {node.id}
              </div>
            </button>
          ))
        ) : (
          <p className="text-sm text-slate-500">No relationships detected.</p>
        )}
      </div>
    </section>
  );
}

export default function AtlasExplorer() {
  const [graph, setGraph] = useState<ExplorerGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [hotspotsOnly, setHotspotsOnly] = useState(false);
  const [showCycles, setShowCycles] = useState(false);
  const [showCoupling, setShowCoupling] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pathTargetId, setPathTargetId] = useState<string | null>(null);
  const [overlayMode, setOverlayMode] =
    useState<OverlayMode>("dependencies");
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [dragging, setDragging] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragOrigin = useRef<{
    pointerX: number;
    pointerY: number;
    viewportX: number;
    viewportY: number;
  } | null>(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setFailure(null);

    try {
      const response = await fetch(
        "/api/truvern/atlas/graph?limit=5000&includeEdges=true&includeOverlays=true",
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Graph API returned ${response.status}`);
      }

      const payload = (await response.json()) as ExplorerGraph;
      setGraph(payload);
      setSelectedId((current) => current ?? payload.nodes[0]?.id ?? null);
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Unable to load ATLAS graph.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const nodeById = useMemo(
    () => new Map((graph?.nodes ?? []).map((node) => [node.id, node])),
    [graph],
  );

  const outgoing = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of graph?.edges ?? []) {
      map.set(edge.source, [...(map.get(edge.source) ?? []), edge.target]);
    }
    return map;
  }, [graph]);

  const incoming = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of graph?.edges ?? []) {
      map.set(edge.target, [...(map.get(edge.target) ?? []), edge.source]);
    }
    return map;
  }, [graph]);

  const undirected = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of graph?.edges ?? []) {
      map.set(edge.source, [...(map.get(edge.source) ?? []), edge.target]);
      map.set(edge.target, [...(map.get(edge.target) ?? []), edge.source]);
    }
    return map;
  }, [graph]);

  const filteredNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return (graph?.nodes ?? [])
      .filter((node) => {
        if (type !== "all" && node.type !== type) return false;
        if (hotspotsOnly && (node.impact?.score ?? 0) <= 0) return false;
        if (!normalizedQuery) return true;

        return [
          node.id,
          node.label,
          node.type,
          JSON.stringify(node.metadata),
          ...node.features,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort(
        (a, b) =>
          (b.impact?.score ?? 0) - (a.impact?.score ?? 0) ||
          a.label.localeCompare(b.label),
      );
  }, [graph, hotspotsOnly, query, type]);

  const visibleNodes = filteredNodes.slice(0, 300);
  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );

  const visibleEdges = useMemo(
    () =>
      (graph?.edges ?? []).filter(
        (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
      ),
    [graph, visibleIds],
  );

  const selectedNode = selectedId ? nodeById.get(selectedId) ?? null : null;

  const dependencies = useMemo(() => {
    if (!selectedNode) return [];
    return (outgoing.get(selectedNode.id) ?? [])
      .map((id) => nodeById.get(id))
      .filter((node): node is GraphNode => Boolean(node));
  }, [nodeById, outgoing, selectedNode]);

  const dependents = useMemo(() => {
    if (!selectedNode) return [];
    return (incoming.get(selectedNode.id) ?? [])
      .map((id) => nodeById.get(id))
      .filter((node): node is GraphNode => Boolean(node));
  }, [incoming, nodeById, selectedNode]);

  const highlightedIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();

    if (overlayMode === "dependencies") {
      return traverse(selectedNode.id, outgoing);
    }

    if (overlayMode === "dependents") {
      return traverse(selectedNode.id, incoming);
    }

    if (overlayMode === "blast") {
      return traverse(selectedNode.id, undirected);
    }

    if (pathTargetId) {
      return new Set(shortestPath(selectedNode.id, pathTargetId, outgoing));
    }

    return new Set([selectedNode.id]);
  }, [
    incoming,
    outgoing,
    overlayMode,
    pathTargetId,
    selectedNode,
    undirected,
  ]);

  const shortestPathIds = useMemo(() => {
    if (!selectedNode || !pathTargetId) return [];
    return shortestPath(selectedNode.id, pathTargetId, outgoing);
  }, [outgoing, pathTargetId, selectedNode]);

  const cycleIds = useMemo(() => {
    const ids = new Set<string>();
    if (!showCycles) return ids;
    for (const cycle of graph?.overlays.cycles ?? []) {
      for (const id of cycle) ids.add(id);
    }
    return ids;
  }, [graph, showCycles]);

  const coupledFeatureIds = useMemo(() => {
    const ids = new Set<string>();
    if (!showCoupling) return ids;

    for (const item of graph?.overlays.featureCoupling ?? []) {
      for (const value of Object.values(item)) {
        if (typeof value === "string" && nodeById.has(value)) ids.add(value);
        if (Array.isArray(value)) {
          for (const candidate of value) {
            if (typeof candidate === "string" && nodeById.has(candidate)) {
              ids.add(candidate);
            }
          }
        }
      }
    }

    return ids;
  }, [graph, nodeById, showCoupling]);

  const layout = useMemo(() => buildLayeredPositions(visibleNodes), [visibleNodes]);

  const fitToScreen = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const scale = clamp(
      Math.min(width / layout.width, height / layout.height) * 0.92,
      MIN_SCALE,
      MAX_SCALE,
    );

    setViewport({
      scale,
      x: (width - layout.width * scale) / 2,
      y: (height - layout.height * scale) / 2,
    });
  }, [layout.height, layout.width]);

  useEffect(() => {
    if (!loading && visibleNodes.length) {
      fitToScreen();
    }
  }, [fitToScreen, loading, visibleNodes.length]);

  const centerOnNode = useCallback(
    (nodeId: string) => {
      const canvas = canvasRef.current;
      const position = layout.positions.get(nodeId);
      if (!canvas || !position) return;

      const scale = Math.max(viewport.scale, 1.15);
      setViewport({
        scale,
        x: canvas.clientWidth / 2 - position.x * scale,
        y: canvas.clientHeight / 2 - position.y * scale,
      });
    },
    [layout.positions, viewport.scale],
  );

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const bounds = canvas.getBoundingClientRect();
      const cursorX = event.clientX - bounds.left;
      const cursorY = event.clientY - bounds.top;
      const multiplier = event.deltaY < 0 ? 1.12 : 0.88;
      const nextScale = clamp(
        viewport.scale * multiplier,
        MIN_SCALE,
        MAX_SCALE,
      );
      const graphX = (cursorX - viewport.x) / viewport.scale;
      const graphY = (cursorY - viewport.y) / viewport.scale;

      setViewport({
        scale: nextScale,
        x: cursorX - graphX * nextScale,
        y: cursorY - graphY * nextScale,
      });
    },
    [viewport],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragOrigin.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        viewportX: viewport.x,
        viewportY: viewport.y,
      };
      setDragging(true);
    },
    [viewport.x, viewport.y],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const origin = dragOrigin.current;
      if (!origin) return;

      setViewport((current) => ({
        ...current,
        x: origin.viewportX + event.clientX - origin.pointerX,
        y: origin.viewportY + event.clientY - origin.pointerY,
      }));
    },
    [],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragOrigin.current = null;
      setDragging(false);
    },
    [],
  );

  const zoomBy = useCallback((multiplier: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setViewport((current) => {
      const nextScale = clamp(
        current.scale * multiplier,
        MIN_SCALE,
        MAX_SCALE,
      );
      const centerX = canvas.clientWidth / 2;
      const centerY = canvas.clientHeight / 2;
      const graphX = (centerX - current.x) / current.scale;
      const graphY = (centerY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: centerX - graphX * nextScale,
        y: centerY - graphY * nextScale,
      };
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomBy(1.15);
      } else if (event.key === "-") {
        event.preventDefault();
        zoomBy(0.85);
      } else if (event.key === "0") {
        event.preventDefault();
        fitToScreen();
      } else if (event.key.toLowerCase() === "c" && selectedNode) {
        event.preventDefault();
        centerOnNode(selectedNode.id);
      } else if (event.key === "Escape") {
        setPathTargetId(null);
        setOverlayMode("dependencies");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [centerOnNode, fitToScreen, selectedNode, zoomBy]);

  const affectedFeatures = useMemo(() => {
    const features = new Set<string>();
    for (const id of highlightedIds) {
      const node = nodeById.get(id);
      if (!node) continue;
      for (const feature of node.features) features.add(feature);
      if (node.type === "feature") features.add(node.id);
    }
    return [...features];
  }, [highlightedIds, nodeById]);

  const affectedTypes = useMemo(() => {
    const result = new Map<string, number>();
    for (const id of highlightedIds) {
      const node = nodeById.get(id);
      if (!node) continue;
      result.set(node.type, (result.get(node.type) ?? 0) + 1);
    }
    return [...result.entries()].sort((a, b) => b[1] - a[1]);
  }, [highlightedIds, nodeById]);

  return (
    <div className="mx-auto w-full max-w-[1900px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.08] via-slate-950 to-indigo-400/[0.06] p-6 shadow-2xl shadow-cyan-950/20">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Truvern Operations Â· ATLAS
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Interactive Architecture Explorer
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
              Navigate Truvernâ€™s architecture, trace dependency paths, simulate
              change impact, and expose hidden coupling before implementation.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadGraph()}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshingâ€¦" : "Refresh graph"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <StatCard label="Nodes" value={graph?.summary.nodes ?? 0} />
          <StatCard label="Edges" value={graph?.summary.edges ?? 0} />
          <StatCard label="Features" value={graph?.summary.features ?? 0} />
          <StatCard label="Cycles" value={graph?.summary.cycles ?? 0} />
          <StatCard
            label="Coupled pairs"
            value={graph?.summary.featureCouplingPairs ?? 0}
          />
          <StatCard label="Highlighted" value={highlightedIds.size} />
        </div>
      </header>

      <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/75 p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Search architecture</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search feature, page, component, API, model, pathâ€¦"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {NODE_TYPES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setType(item)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  type === item
                    ? "bg-cyan-400 text-slate-950"
                    : "border border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                {item === "all" ? "All" : nodeTypeLabel(item)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setHotspotsOnly((current) => !current)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                hotspotsOnly
                  ? "bg-amber-300 text-slate-950"
                  : "border border-white/10 bg-white/[0.035] text-slate-300"
              }`}
            >
              Hotspots
            </button>
            <button
              type="button"
              onClick={() => setShowCycles((current) => !current)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                showCycles
                  ? "bg-rose-300 text-slate-950"
                  : "border border-white/10 bg-white/[0.035] text-slate-300"
              }`}
            >
              Cycles
            </button>
            <button
              type="button"
              onClick={() => setShowCoupling((current) => !current)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                showCoupling
                  ? "bg-indigo-300 text-slate-950"
                  : "border border-white/10 bg-white/[0.035] text-slate-300"
              }`}
            >
              Coupling
            </button>
          </div>
        </div>
      </section>

      {failure ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-5 text-sm text-rose-100">
          <div className="font-semibold">ATLAS graph unavailable</div>
          <p className="mt-1 text-rose-200/75">{failure}</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#030b1d]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="font-semibold text-white">Dependency canvas</h2>
              <p className="mt-1 text-xs text-slate-500">
                Drag to pan Â· scroll to zoom Â· +/âˆ’ zoom Â· 0 fit Â· C center
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["dependencies", "Upstream"],
                  ["dependents", "Downstream"],
                  ["blast", "Blast radius"],
                  ["path", "Shortest path"],
                ] as Array<[OverlayMode, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOverlayMode(value)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    overlayMode === value
                      ? "bg-cyan-400 text-slate-950"
                      : "border border-white/10 bg-white/[0.035] text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => zoomBy(1.15)}
                className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-200"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => zoomBy(0.85)}
                className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-200"
                aria-label="Zoom out"
              >
                âˆ’
              </button>
              <button
                type="button"
                onClick={fitToScreen}
                className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-slate-200"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => setViewport(DEFAULT_VIEWPORT)}
                className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-slate-200"
              >
                Reset
              </button>
            </div>
          </div>

          {overlayMode === "path" ? (
            <div className="border-b border-white/10 bg-cyan-400/[0.04] px-5 py-3">
              <select
                value={pathTargetId ?? ""}
                onChange={(event) =>
                  setPathTargetId(event.target.value || null)
                }
                className="h-10 w-full max-w-xl rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white"
              >
                <option value="">Select a target node for shortest path</option>
                {visibleNodes
                  .filter((node) => node.id !== selectedNode?.id)
                  .map((node) => (
                    <option key={node.id} value={node.id}>
                      {nodeTypeLabel(node.type)} Â· {node.label}
                    </option>
                  ))}
              </select>
              {pathTargetId && !shortestPathIds.length ? (
                <p className="mt-2 text-xs text-amber-200">
                  No directed dependency path was found.
                </p>
              ) : null}
            </div>
          ) : null}

          <div
            ref={canvasRef}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`relative h-[760px] touch-none overflow-hidden select-none ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Loading architecture graphâ€¦
              </div>
            ) : visibleNodes.length ? (
              <>
                <svg
                  width={layout.width}
                  height={layout.height}
                  viewBox={`0 0 ${layout.width} ${layout.height}`}
                  className="absolute left-0 top-0"
                  style={{
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                    transformOrigin: "0 0",
                  }}
                  role="img"
                  aria-label="ATLAS interactive architecture dependency graph"
                >
                  <defs>
                    <marker
                      id="atlas-arrow"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6"
                      refY="3"
                      orient="auto"
                    >
                      <path
                        d="M0,0 L0,6 L7,3 z"
                        fill="rgba(148,163,184,0.35)"
                      />
                    </marker>
                  </defs>

                  {visibleEdges.slice(0, 1600).map((edge) => {
                    const source = layout.positions.get(edge.source);
                    const target = layout.positions.get(edge.target);
                    if (!source || !target) return null;

                    const pathEdge =
                      shortestPathIds.length > 1 &&
                      shortestPathIds.some(
                        (id, index) =>
                          id === edge.source &&
                          shortestPathIds[index + 1] === edge.target,
                      );

                    const highlighted =
                      pathEdge ||
                      (highlightedIds.has(edge.source) &&
                        highlightedIds.has(edge.target));

                    return (
                      <line
                        key={edge.id}
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={
                          pathEdge
                            ? "rgba(244,114,182,0.95)"
                            : highlighted
                              ? "rgba(34,211,238,0.72)"
                              : "rgba(100,116,139,0.16)"
                        }
                        strokeWidth={pathEdge ? 3 : highlighted ? 1.8 : 0.8}
                        markerEnd="url(#atlas-arrow)"
                      />
                    );
                  })}

                  {visibleNodes.map((node) => {
                    const position = layout.positions.get(node.id);
                    if (!position) return null;

                    const selected = selectedNode?.id === node.id;
                    const hotspot = (node.impact?.score ?? 0) > 0;
                    const highlighted = highlightedIds.has(node.id);
                    const inCycle = cycleIds.has(node.id);
                    const coupled = coupledFeatureIds.has(node.id);

                    let fill = "rgb(100,116,139)";
                    if (coupled) fill = "rgb(165,180,252)";
                    if (inCycle) fill = "rgb(251,113,133)";
                    if (hotspot) fill = "rgb(251,191,36)";
                    if (highlighted) fill = "rgb(34,211,238)";
                    if (selected) fill = "rgb(255,255,255)";

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${position.x},${position.y})`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(node.id);
                          if (overlayMode === "path" && selectedNode) {
                            setPathTargetId(node.id);
                          }
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(node.id);
                          centerOnNode(node.id);
                        }}
                        className="cursor-pointer"
                      >
                        <circle
                          r={selected ? 10 : highlighted ? 7.5 : hotspot ? 6.5 : 5}
                          fill={fill}
                          stroke={
                            selected
                              ? "rgb(34,211,238)"
                              : "rgba(255,255,255,0.28)"
                          }
                          strokeWidth={selected ? 3 : 1}
                        />
                        {selected || highlighted ? (
                          <text
                            x="14"
                            y="4"
                            fill="white"
                            fontSize="12"
                            fontWeight={selected ? "700" : "500"}
                          >
                            {node.label.slice(0, 46)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </svg>

                <div className="absolute bottom-4 right-4 h-32 w-48 overflow-hidden rounded-xl border border-white/10 bg-slate-950/90 shadow-2xl">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="h-full w-full"
                    aria-label="ATLAS graph mini-map"
                  >
                    {visibleEdges.slice(0, 600).map((edge) => {
                      const source = layout.positions.get(edge.source);
                      const target = layout.positions.get(edge.target);
                      if (!source || !target) return null;
                      return (
                        <line
                          key={`mini-${edge.id}`}
                          x1={source.x}
                          y1={source.y}
                          x2={target.x}
                          y2={target.y}
                          stroke="rgba(100,116,139,0.18)"
                          strokeWidth="2"
                        />
                      );
                    })}
                    {visibleNodes.map((node) => {
                      const position = layout.positions.get(node.id);
                      if (!position) return null;
                      return (
                        <circle
                          key={`mini-${node.id}`}
                          cx={position.x}
                          cy={position.y}
                          r={selectedNode?.id === node.id ? 9 : 4}
                          fill={
                            selectedNode?.id === node.id
                              ? "rgb(34,211,238)"
                              : "rgb(100,116,139)"
                          }
                        />
                      );
                    })}
                  </svg>
                </div>

                <div className="absolute bottom-4 left-4 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-400">
                  Zoom {Math.round(viewport.scale * 100)}% Â·{" "}
                  {visibleEdges.length} edges
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No architecture nodes match the current filters.
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
            {selectedNode ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                      {nodeTypeLabel(selectedNode.type)}
                    </div>
                    <h2 className="mt-2 break-words text-xl font-semibold text-white">
                      {selectedNode.label}
                    </h2>
                    <p className="mt-2 break-all text-xs leading-5 text-slate-500">
                      {selectedNode.id}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-3 py-2 text-center">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-amber-200/70">
                      Impact
                    </div>
                    <div className="text-xl font-semibold text-amber-200">
                      {selectedNode.impact?.score ?? 0}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => centerOnNode(selectedNode.id)}
                  className="mt-4 w-full rounded-xl border border-cyan-300/20 bg-cyan-400/[0.07] px-3 py-2 text-sm font-semibold text-cyan-100"
                >
                  Center node on canvas
                </button>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <StatCard
                    label="Dependencies"
                    value={
                      selectedNode.impact?.directDependencyCount ??
                      dependencies.length
                    }
                  />
                  <StatCard
                    label="Dependents"
                    value={
                      selectedNode.impact?.directDependentCount ??
                      dependents.length
                    }
                  />
                  <StatCard
                    label="Forward radius"
                    value={selectedNode.impact?.forwardBlastRadiusCount ?? 0}
                  />
                  <StatCard
                    label="Reverse radius"
                    value={selectedNode.impact?.reverseBlastRadiusCount ?? 0}
                  />
                </div>

                {selectedNode.features.length ? (
                  <div className="mt-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Feature membership
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedNode.features.map((feature) => (
                        <span
                          key={feature}
                          className="rounded-full border border-indigo-300/15 bg-indigo-400/[0.08] px-2.5 py-1 text-xs text-indigo-200"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Metadata
                  </div>
                  <dl className="mt-3 space-y-3">
                    {Object.entries(selectedNode.metadata)
                      .filter(([, value]) => formatMetadata(value))
                      .slice(0, 16)
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-xs font-medium text-slate-500">
                            {key}
                          </dt>
                          <dd className="mt-1 break-words text-sm text-slate-300">
                            {formatMetadata(value)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Select a graph node to inspect its architecture impact.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.045] p-4">
            <h3 className="font-semibold text-white">Change simulation</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Estimated architecture exposure for the current highlight mode.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatCard label="Affected nodes" value={highlightedIds.size} />
              <StatCard label="Affected features" value={affectedFeatures.length} />
            </div>

            <div className="mt-4 space-y-2">
              {affectedTypes.map(([affectedType, count]) => (
                <div
                  key={affectedType}
                  className="flex items-center justify-between rounded-lg bg-slate-950/40 px-3 py-2 text-sm"
                >
                  <span className="text-slate-400">
                    {nodeTypeLabel(affectedType)}
                  </span>
                  <span className="font-semibold text-white">{count}</span>
                </div>
              ))}
            </div>
          </section>

          <RelationshipList
            title="Direct dependencies"
            nodes={dependencies}
            onSelect={(node) => {
              setSelectedId(node.id);
              centerOnNode(node.id);
            }}
          />
          <RelationshipList
            title="Direct dependents"
            nodes={dependents}
            onSelect={(node) => {
              setSelectedId(node.id);
              centerOnNode(node.id);
            }}
          />

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h3 className="font-semibold text-white">Graph status</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              <div className="flex justify-between gap-4">
                <span>Generated</span>
                <span className="text-right text-slate-300">
                  {graph?.generatedAt
                    ? new Date(graph.generatedAt).toLocaleString()
                    : "â€”"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Version</span>
                <span className="text-slate-300">{graph?.version ?? "â€”"}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

