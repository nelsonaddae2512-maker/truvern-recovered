// app/api/trust/verify/route.ts
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

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const vendorId = parseNumericId(url.searchParams.get("vendorId"));
    if (!vendorId) return json({ ok: false, error: "Invalid vendorId" }, 400);

    const org = await requireDbOrganization().catch(() => null);
    if (!org) return json({ ok: false, error: "Unauthorized" }, 401);

    const orgId = Number((org as any)?.id);
    if (!Number.isFinite(orgId) || orgId <= 0)
      return json({ ok: false, error: "Unauthorized" }, 401);

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, organizationId: orgId },
      select: { id: true },
    });

    if (!vendor)
      return json({ ok: false, error: "Vendor not found", vendorId }, 404);

    /**
     * IMPORTANT:
     * We do NOT select optional/variant fields directly.
     * Instead, read the row as `any` and resolve safely.
     */
    const row: any = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!row)
      return json({ ok: false, error: "Vendor not found", vendorId }, 404);

    const verifiedAt =
      row.trustVerifiedAt ??
      row.verifiedAt ??
      row.trust_verified_at ??
      null;

    return json({
      ok: true,
      vendorId,
      verified: !!verifiedAt,
      verifiedAt,
    });
  } catch (e: any) {
    return json(
      { ok: false, error: safeStr(e?.message) || "Verification failed" },
      500
    );
  }
}




