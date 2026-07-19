// app/api/trust/snapshots/[vendorId]/undo/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function parseNumericId(raw: unknown): number | null {
  const m = String(raw ?? "").match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type Ctx =
  | { vendorId: string }
  | { params: { vendorId: string } }
  | Promise<{ vendorId: string }>
  | { params: Promise<{ vendorId: string }> };

async function getVendorIdFromCtx(ctx: any): Promise<number | null> {
  const direct = ctx?.vendorId ?? null;
  const nested = ctx?.params ?? null;
  const maybe = direct ?? nested;
  const resolved = typeof maybe?.then === "function" ? await maybe : maybe;
  return parseNumericId(resolved?.vendorId);
}

function pickSnapshotModel() {
  // Prefer vendorRiskSnapshot (your current schema), fallback to riskSnapshot (older branches)
  return ((prisma as any).vendorRiskSnapshot || (prisma as any).riskSnapshot || null) as any;
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const vendorId = await getVendorIdFromCtx(ctx);
    if (!vendorId) return json({ ok: false, error: "Invalid vendorId" }, 400);

    const orgRes = await requireDbOrganization().catch(() => null);
    if (!orgRes) return json({ ok: false, error: "Unauthorized" }, 401);

    const orgId = Number((orgRes as any)?.id);
    if (!Number.isFinite(orgId) || orgId <= 0) return json({ ok: false, error: "Unauthorized" }, 401);

    // œ… FIX: schema uses organizationId, not orgId
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, organizationId: orgId },
      select: { id: true },
    });

    if (!vendor) return json({ ok: false, error: "Vendor not found", vendorId }, 404);

    const snapModel = pickSnapshotModel();
    if (!snapModel?.findFirst || !snapModel?.delete) {
      return json({ ok: false, error: "Snapshot model not available in this schema" }, 501);
    }

    // Undo = delete the latest snapshot (prefer sealedAt desc if present)
    const latest =
      (await snapModel
        .findFirst({
          where: { vendorId, organizationId: orgId } as any,
          orderBy: [{ sealedAt: "desc" }, { createdAt: "desc" }] as any,
          select: { id: true } as any,
        })
        .catch(async () => {
          return snapModel.findFirst({
            where: { vendorId, organizationId: orgId } as any,
            orderBy: [{ createdAt: "desc" }] as any,
            select: { id: true } as any,
          });
        })) ?? null;

    if (!latest?.id) {
      return json({ ok: true, deletedId: null, message: "No snapshots to undo." }, 200);
    }

    await snapModel.delete({ where: { id: latest.id } as any });

    return json({ ok: true, deletedId: latest.id }, 200);
  } catch (e: any) {
    return json({ ok: false, error: safeStr(e?.message) || "Failed to undo snapshot" }, 500);
  }
}





