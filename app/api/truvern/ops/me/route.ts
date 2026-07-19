import { NextResponse } from "next/server";
import { isTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    isOperator: await isTruvernOperator(),
  });
}

