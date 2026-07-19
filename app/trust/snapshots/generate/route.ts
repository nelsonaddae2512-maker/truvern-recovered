// app/api/trust/snapshots/generate/route.ts
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

function pickSnapshotModel() {
  // Prefer current schema model; fallback for older branches
  return ((prisma as any).vendorRiskSnapshot || (prisma as any).riskSnapshot || null) as any;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const vendorId = parseNumericId(url.searchParams.get("vendorId"));
    if (!vendorId) return json({ ok: false, error: "Invalid vendorId" }, 400);

    const org = await requireDbOrganization().catch(() => null);
    if (!org) return json({ ok: false, error: "Unauthorized" }, 401);

    const orgId = Number((org as any)?.id);
    if (!Number.isFinite(orgId) || orgId <= 0) return json({ ok: false, error: "Unauthorized" }, 401);

    // œ… FIX: schema uses organizationId, not orgId
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, organizationId: orgId },
      select: { id: true },
    });

    if (!vendor) return json({ ok: false, error: "Vendor not found", vendorId }, 404);

    const snapModel = pickSnapshotModel();
    if (!snapModel?.create) {
      return json({ ok: false, error: "Snapshot model not available in this schema" }, 501);
    }

    // Minimal snapshot payload compatible with your current VendorRiskSnapshot schema:
    // { organizationId, vendorId, score?, label?, summary?, details?, sealedAt?, sealedHash? }
    const created = await snapModel.create({
      data: {
        organizationId: orgId,
        vendorId,
        // keep it minimal; compute score elsewhere if needed
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
      select: { id: true, vendorId: true, organizationId: true, createdAt: true } as any,
    });

    return json({ ok: true, snapshot: created }, 200);
  } catch (e: any) {
    return json({ ok: false, error: safeStr(e?.message) || "Failed to generate snapshot" }, 500);
  }
}





