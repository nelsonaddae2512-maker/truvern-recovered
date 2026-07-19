import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}
function safeInt(v: any) {
  const n =
    typeof v === "string" ? Number.parseInt(v, 10) : typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? n : null;
}
async function readBodyAny(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const data = await req.json();
      return { ok: true as const, data };
    } catch {
      return { ok: false as const, error: "Invalid JSON body" };
    }
  }
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const fd = await req.formData();
      const data: Record<string, any> = {};
      fd.forEach((v, k) => (data[k] = v));
      return { ok: true as const, data };
    } catch {
      return { ok: false as const, error: "Invalid form body" };
    }
  }
  return { ok: true as const, data: {} };
}

export async function POST(req: Request) {
  const routeSig = "risk-snapshots/regenerate@v4";

  try {
    const org = await requireDbOrganization();

    const bodyRes = await readBodyAny(req);
    if (!bodyRes.ok) return json({ routeSig, ok: false, error: bodyRes.error }, 400);

    const url = new URL(req.url);
    const vendorId =
      safeInt((bodyRes.data as any)?.vendorId) ??
      safeInt((bodyRes.data as any)?.id) ??
      safeInt(url.searchParams.get("vendorId"));

    if (!vendorId) return json({ routeSig, ok: false, error: "Invalid vendorId" }, 400);

    // ðŸ”’ Ensure vendor belongs to org
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, organizationId: "id" in org ? org.id : 0 },
      select: { id: true, name: true },
    });
    if (!vendor) return json({ routeSig, ok: false, error: "Vendor not found" }, 404);

    const label = typeof (bodyRes.data as any)?.label === "string" ? (bodyRes.data as any).label : null;
    const summary =
      typeof (bodyRes.data as any)?.summary === "string" ? (bodyRes.data as any).summary : null;

    const result = await prisma.$transaction(async (tx: any) => {
      const latest = await tx.vendorRiskSnapshot.findFirst({
        where: { vendorId: vendor.id },
        orderBy: { id: "desc" },
      });

      if (latest) {
        await tx.vendorRiskSnapshot.delete({ where: { id: latest.id } });
      }

      const created = await tx.vendorRiskSnapshot.create({
        data: {
          vendorId: vendor.id,
          score: 50, // TODO: replace with real scoring logic
          ...(label ? { label } : {}),
          ...(summary ? { summary } : {}),
        } as any,
        select: { id: true, vendorId: true, score: true, summary: true } as any,
      });

      return { deleted: latest || null, created };
    });

    return json({ routeSig, ok: true, vendorId: vendor.id, ...result });
  } catch (e: any) {
    return json(
      {
        routeSig: "risk-snapshots/regenerate@v4",
        ok: false,
        error: "Unable to regenerate snapshot",
        details: String(e?.message || e),
      },
      500
    );
  }
}








