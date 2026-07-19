// app/api/trust/snapshots/[vendorId]/generate/route.ts
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
  const m: any = (prisma as any).vendorRiskSnapshot || (prisma as any).riskSnapshot || null;
  return m;
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
    if (!snapModel?.create) {
      return json(
        { ok: false, error: "Snapshot model not available in this schema" },
        501
      );
    }

    // Create a snapshot record (minimal fields that exist in your current schema)
    // NOTE: we avoid selecting/setting unknown columns like takenAt/archivedAt/etc.
    const created = await snapModel.create({
      data: {
        organizationId: orgId,
        vendorId,
        // leave score/label/summary/details empty here; compute job can fill these later
      } as any,
      select: { id: true, vendorId: true, organizationId: true, createdAt: true } as any,
    });

    return json({ ok: true, created }, 200);
  } catch (e: any) {
    return json(
      { ok: false, error: safeStr(e?.message) || "Failed to generate snapshot" },
      500
    );
  }
}





