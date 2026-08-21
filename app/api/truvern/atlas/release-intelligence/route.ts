import { NextRequest, NextResponse } from "next/server";

import {
  getAtlasReleaseDiff,
  listAtlasReleaseSnapshots,
} from "@/lib/atlas/release-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const baseline =
      request.nextUrl.searchParams.get("baseline")?.trim() || undefined;

    return NextResponse.json({
      snapshots: listAtlasReleaseSnapshots(),
      diff: getAtlasReleaseDiff(baseline),
    });
  } catch (error) {
    console.error("ATLAS Release Intelligence failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ATLAS Release Intelligence failed.",
      },
      { status: 500 },
    );
  }
}
