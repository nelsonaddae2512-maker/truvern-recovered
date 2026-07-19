import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

function safeInt(v: unknown): number | null {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function riskLabel(score: number | null) {
  if (score === null) return "Unknown";
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

export async function POST(req: Request) {
  try {
    const org = await requireDbOrganization();
    const body = await req.json().catch(() => ({}));

    const vendorId = safeInt(body?.vendorId);
    if (!vendorId) {
      return json({ ok: false, reason: "INVALID_VENDOR_ID" }, 400);
    }

    const vendor = await prisma.vendor.findFirst({
      where: {
        id: vendorId,
        organizationId: "id" in org ? org.id : 0,
      },
      select: {
        id: true,
        name: true,
        riskScore: true,
      },
    });

    if (!vendor) {
      return json({ ok: false, reason: "VENDOR_NOT_FOUND" }, 404);
    }

    const score =
      typeof vendor.riskScore === "number" && Number.isFinite(vendor.riskScore)
        ? vendor.riskScore
        : null;

    const snapshot = await prisma.vendorRiskSnapshot.create({
      data: {
        vendorId: vendor.id,
        score: score ?? 0,
      },
      select: {
        id: true,
        vendorId: true,
        score: true,
      },
    });

    return json({
      ok: true,
      snapshot,
      label: riskLabel(score),
    });
  } catch (err: any) {
    return json(
      {
        ok: false,
        reason: "SERVER_ERROR",
        message: String(err?.message || err),
      },
      500,
    );
  }
}





