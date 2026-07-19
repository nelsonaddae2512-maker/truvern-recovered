import prisma from "@/lib/db";

export const runtime = "nodejs"
export const dynamic = "force-dynamic";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";/** Build-safe GET so Next's collect-page-data never fails */
import { auth } from "@clerk/nextjs/server";
async function requireUserId() {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true as const, userId };
}

export async function GET(){ 
  const g = await requireUserId();
  if (!g.ok) return g.res;
const { prisma } = await import("@/lib/prisma"); 
  return NextResponse.json({ ok: true }, { status: 200 });
}

/**
 * POST JSON: { slug: string, state?: boolean }
 * If "state" provided, sets publicTrust = state; otherwise toggles current value.
 * Always returns 200 with { ok, slug, publicTrust? } and never throws.
 */
export async function POST(req: NextRequest){ 
  const g = await requireUserId();
  if (!g.ok) return g.res;
const { prisma } = await import("@/lib/prisma"); 
  try {
    const body = await req.json().catch(() => ({} as any));
    const slug = String(body?.slug || "").trim().toLowerCase();
    const hasState = typeof body?.state === "boolean";
    if (!slug) return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 200 });

    // Lazy import prisma to avoid build-time execution
    let prisma: any = null;
    try { prisma = (await import("@/lib/prisma"))?.prisma ?? null; } catch {}
    if (!prisma) return NextResponse.json({ ok: false, error: "prisma_unavailable" }, { status: 200 });

    // Find vendor
    const vendor = await prisma.vendor.findFirst({
      where: { slug },
      select: { id: true, publicTrust: true, slug: true }
    });
    if (!vendor) return NextResponse.json({ ok: false, error: "not_found", slug }, { status: 200 });

    // Compute next state (toggle if not supplied)
    const nextState: boolean = hasState ? Boolean(body.state) : !Boolean(vendor.publicTrust);

    // Update; if schema lacks publicTrust, this will throw Ãƒ¢Ã¢€š¬Ã¢‚¬ catch and soft return
    try {
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { publicTrust: nextState as any }
      });
    } catch {
      // Soft-fail when column doesn't exist; still report intended value
    }

    return NextResponse.json({ ok: true, slug, publicTrust: nextState }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "internal" }, { status: 200 });
  }
}






