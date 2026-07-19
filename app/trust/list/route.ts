import prisma from "@/lib/db";

export const runtime = "nodejs"
export const dynamic = "force-dynamic";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";type AnswerLite = { frameworks?: string[] | null };
import { auth } from "@clerk/nextjs/server";
async function requireUserId() {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true as const, userId };
}

type VendorLite = { id: string; name: string; slug: string }
export async function GET(req: NextRequest){ 
  const g = await requireUserId();
  if (!g.ok) return g.res;
const { prisma } = await import("@/lib/prisma"); 
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);

    const mod = (await import("@/lib/prisma")) as { prisma?: any };
    const prisma = mod?.prisma;
    if (!prisma) return NextResponse.json({ ok: true, items: [], total: 0 }, { status: 200 });

    const vendors: VendorLite[] = await prisma.vendor.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { updatedAt: "desc" },
      take: 500
    });

    const items: Array<{ name: string; slug: string; frameworks: string[] }> = [];

    for (const v of vendors) {
      if (q && !v.name.toLowerCase().includes(q) && !v.slug.toLowerCase().includes(q)) continue;
      const answers: AnswerLite[] = await prisma.answer.findMany({ where: { vendorId: v.id }, select: { frameworks: true } });
      const set = new Set<string>();
      answers.forEach((a: AnswerLite) => (a.frameworks ?? []).forEach((f: string) => set.add(f)));
      items.push({ name: v.name, slug: v.slug, frameworks: Array.from(set).sort().slice(0, 8) });
      if (items.length >= limit) break;
    }

    return NextResponse.json({ ok: true, items, total: items.length }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: true, items: [], total: 0 }, { status: 200 });
  }
}





