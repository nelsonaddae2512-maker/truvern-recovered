import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "This remediation submission endpoint is disabled. Use the token-bound vendor evidence workflow.",
    },
    {
      status: 410,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}