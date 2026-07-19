import { NextResponse } from "next/server";
import { getCurrentPlanEntitlements } from "@/lib/billing/plan-entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const entitlements = await getCurrentPlanEntitlements();

  return NextResponse.json({
    plan: entitlements.plan,
  });
}

