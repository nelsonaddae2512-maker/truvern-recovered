import { NextRequest, NextResponse } from "next/server";

import {
  filterAtlasGraph,
  loadAtlasExplorerGraph,
} from "@/lib/atlas/graph-engine";

export const dynamic = "force-dynamic";

function readBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value !== "false" && value !== "0";
}

export async function GET(request: NextRequest) {
  try {
    const graph = await loadAtlasExplorerGraph();
    const search = request.nextUrl.searchParams;

    const result = filterAtlasGraph(graph, {
      q: search.get("q") ?? undefined,
      type: search.get("type") ?? undefined,
      feature: search.get("feature") ?? undefined,
      limit: Number(search.get("limit") || 500),
      includeEdges: readBoolean(search.get("includeEdges"), true),
      includeOverlays: readBoolean(search.get("includeOverlays"), true),
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to load ATLAS explorer graph", error);

    return NextResponse.json(
      {
        error: "ATLAS_GRAPH_UNAVAILABLE",
        message:
          "The ATLAS explorer graph could not be loaded. Run pnpm atlas:graph.",
      },
      { status: 503 },
    );
  }
}
