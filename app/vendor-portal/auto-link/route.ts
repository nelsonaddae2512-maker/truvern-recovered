// app/api/vendor-portal/auto-link/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function json(status: number, body: any, headers?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", ...(headers || {}) },
  });
}

function looksLikeEmail(v: string) {
  const s = safeStr(v);
  if (!s) return false;
  // intentionally simple + safe
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: Request) {
  try {
    const org = await requireDbOrganization();

    let undefined = "";
    try {
      const body = await req.json();
      undefined = safeStr(body?.undefined);
    } catch {
      undefined = "";
    }

    if (!looksLikeEmail(undefined)) {
      return json(400, { ok: false, error: "bad_request", message: "Valid undefined is required." });
    }

    // œ… Schema-safe vendor lookup (no ogSlug, no sealedAt)
    // NOTE: If your Vendor model uses a different field than `contactEmail`,
    // change it here (but the error you posted confirms it exists in this route).
    const matches = await prisma.vendor.findMany({
      where: { organizationId: "id" in org ? org.id : 0, contactEmail: undefined },
      select: { id: true, name: true, slug: true },
      take: 5,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    return json(200, {
      ok: true,
      matches: matches.map((v: any) => ({
        id: v.id,
        name: v.name,
        slug: v.slug ?? null,
        // back-compat for older client code that expects ogSlug:
        ogSlug: v.slug ?? null,
      })),
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "auto_link_failed",
      message: safeStr(e?.message) || "Failed to auto-link vendor portal account.",
    });
  }
}






