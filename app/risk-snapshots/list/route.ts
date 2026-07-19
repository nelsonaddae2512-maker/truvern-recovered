// app/api/risk-snapshots/list/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROUTE_SIG = "risk-snapshots/list@v2";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function intParam(v: string | null, fallback: number) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function toIntStrict(v: string | null) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function pickOne(v: string | string[] | null | undefined) {
  return Array.isArray(v) ? v[0] : v ?? null;
}

/**
 * Try to find the Prisma model key that represents risk snapshots.
 * Prisma client model keys are usually lowerCamelCase, e.g.:
 *   prisma.riskSnapshot, prisma.vendorRiskSnapshot, prisma.riskSnapshots, etc.
 *
 * You can force a key with ?model=<key>
 */
function getSnapshotModelKey(preferKey?: string | null) {
  const p: any = prisma as any;

  // If user provided an override, trust it if it looks callable.
  if (preferKey) {
    const m = p[preferKey];
    if (m && typeof m.findMany === "function") return preferKey;
  }

  // Common candidates (ordered)
  const candidates = [
    "riskSnapshot",
    "riskSnapshots",
    "vendorRiskSnapshot",
    "riskSnapshots",
    "snapshot",
    "snapshots",
    "vendorSnapshot",
    "vendorSnapshots",
  ];

  for (const k of candidates) {
    const m = p[k];
    if (m && typeof m.findMany === "function") return k;
  }

  // Heuristic scan: any key containing "snapshot" and supporting findMany.
  const keys = Object.keys(p);
  for (const k of keys) {
    if (!/snapshot/i.test(k)) continue;
    const m = p[k];
    if (m && typeof m.findMany === "function") return k;
  }

  return null;
}

async function tryFindMany(model: any, args: any) {
  // Small helper to keep try/catch readable
  return await model.findMany(args);
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const vendorId = toIntStrict(url.searchParams.get("vendorId"));
  const take = Math.min(intParam(url.searchParams.get("take"), 25), 200);
  const onlyLatest = (url.searchParams.get("latest") || "").trim() === "1";
  const includeVendor = (url.searchParams.get("includeVendor") || "").trim() === "1";
  const preferModelKey = pickOne(url.searchParams.getAll("model")) ?? url.searchParams.get("model");

  if (!vendorId) {
    return json({ routeSig: ROUTE_SIG, ok: false, error: "Missing vendorId" }, 400);
  }

  try {
    // œ… Enforce org scope via Vendor table (stable regardless of snapshot schema)
    const org = await requireDbOrganization();

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, organizationId: "id" in org ? org.id : 0 },
      select: { id: true, name: true, slug: true, organizationId: true },
    });

    if (!vendor) {
      return json(
        {
          routeSig: ROUTE_SIG,
          ok: false,
          vendorId,
          error: "Vendor not found for org",
          mode: "salvaged",
        },
        404
      );
    }

    // œ… Locate the snapshot model dynamically
    const modelKey = getSnapshotModelKey(preferModelKey);
    if (!modelKey) {
      return json(
        {
          routeSig: ROUTE_SIG,
          ok: false,
          vendorId,
          error: "No snapshot model found on Prisma client",
          hint:
            "Try adding ?model=<prismaClientKey> once you identify the right model key (see /api/risk-snapshots/list?debug=1)",
          mode: "salvaged",
        },
        500
      );
    }

    const p: any = prisma as any;
    const SnapshotModel = p[modelKey];

    // Build query
    const baseArgs: any = {
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      take: onlyLatest ? 1 : take,
    };

    // We *optionally* include vendor if the relation exists, but don't fail if it doesn't.
    // We'll always return the org-scoped vendor info we already fetched.
    let rows: any[] = [];
    let mode: "normal" | "salvaged" = "normal";

    try {
      if (includeVendor) {
        rows = await tryFindMany(SnapshotModel, {
          ...baseArgs,
          include: { vendor: { select: { id: true, name: true, slug: true } } },
        });
      } else {
        rows = await tryFindMany(SnapshotModel, baseArgs);
      }
    } catch {
      mode = "salvaged";
      // Fallback: no include, just raw rows
      rows = await tryFindMany(SnapshotModel, baseArgs);
    }

    // Minimal, safe mapping: we don€™t assume field names beyond id/vendorId/createdAt.
    const items = (rows || []).map((s: any) => ({
      id: s?.id ?? null,
      vendorId: s?.vendorId ?? vendorId,
      createdAt: s?.createdAt ?? null,
      // Common optional fields (won't break if absent)
      score: s?.score ?? s?.riskScore ?? null,
      label: s?.label ?? s?.riskLabel ?? null,
      summary: s?.summary ?? null,
      mode: s?.mode ?? null,
      // If includeVendor worked, vendor may be attached; otherwise undefined.
      vendor: includeVendor ? s?.vendor : undefined,
    }));

    return json({
      routeSig: ROUTE_SIG,
      ok: true,
      vendorId,
      modelKey,
      count: items.length,
      latestId: items[0]?.id ?? null,
      mode,
      vendor, // always include org-scoped vendor info
      items,
    });
  } catch (e: any) {
    return json(
      {
        routeSig: ROUTE_SIG,
        ok: false,
        vendorId,
        error: String(e?.message || e || "Unknown error"),
        mode: "salvaged",
      },
      500
    );
  }
}







