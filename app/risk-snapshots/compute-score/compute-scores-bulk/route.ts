// app/api/risk-snapshots/compute-score/compute-scores-bulk/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseVendorIds(input: unknown): number[] {
  // Accept: number | string | array of either | comma-separated string
  if (Array.isArray(input)) {
    const out: number[] = [];
    for (const v of input) {
      const n = num(v);
      if (n) out.push(n);
    }
    return Array.from(new Set(out));
  }

  if (typeof input === "string") {
    const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
    const out: number[] = [];
    for (const p of parts) {
      const n = num(p);
      if (n) out.push(n);
    }
    return Array.from(new Set(out));
  }

  const one = num(input);
  return one ? [one] : [];
}

type Body =
  | {
      vendorIds?: unknown;
      vendorId?: unknown;
      dryRun?: unknown;
    }
  | null
  | undefined;

function isTrue(v: unknown) {
  if (typeof v === "boolean") return v;
  const s = safeStr(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

async function computeScoreForVendor(orgId: number, vendorId: number) {
  // NOTE: keep conservative selections so schema variance doesn't break
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      organizationId: true,
      riskScore: true,
      
      _count: {
        select: {
          issues: true,
          evidenceRequests: true,
          evidence: true,
          assessments: true,
        },
      },
      riskSnapshots: {
        take: 1,
        orderBy: { id: "desc" },
        select: { id: true, score: true,    },
      },
    },
  });

  if (!vendor) {
    return { ok: false as const, vendorId, error: "not_found" };
  }
  if (vendor.organizationId !== orgId) {
    return { ok: false as const, vendorId, error: "forbidden" };
  }

  // Simple, stable heuristic (won't depend on optional schema fields):
  // - More issues and overdue/requests should increase risk
  // - More evidence/assessments should reduce risk slightly
  const issues = (vendor as any)._count.issues || 0;
  const reqs = (vendor as any)._count.evidenceRequests || 0;
  const evid = (vendor as any)._count.evidence || 0;
  const asses = (vendor as any)._count.assessments || 0;

  let score =
    10 +
    issues * 12 +
    reqs * 6 -
    Math.min(evid, 20) * 1.2 -
    Math.min(asses, 10) * 2;

  if (!Number.isFinite(score)) score = 50;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    ok: true as const,
    vendorId,
    score,
    counts: { issues, evidenceRequests: reqs, evidence: evid, assessments: asses },
    prevSnapshot: (vendor as any).riskSnapshots?.[0] ?? null,
  };
}

export async function POST(req: Request) {
  const org = await requireDbOrganization().catch(() => null);
  const orgId = Number((org as any)?.id);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Body = null;
  try {
    body = (await req.json()) as Body;
  } catch {
    body = null;
  }

  const ids = [
    ...parseVendorIds((body as any)?.vendorIds),
    ...parseVendorIds((body as any)?.vendorId),
  ];
  const vendorIds = Array.from(new Set(ids));

  if (vendorIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing vendorIds" },
      { status: 400 }
    );
  }

  const dryRun = isTrue((body as any)?.dryRun);

  const results: any[] = [];
  for (const vendorId of vendorIds) {
    // œ… FIX: vendorId is guaranteed number here, so Prisma where.id is number (not unknown)
    const computed = await computeScoreForVendor(orgId, vendorId);
    if (!computed.ok) {
      results.push(computed);
      continue;
    }

    if (!dryRun) {
      // Update vendor.riskScore (exists in your schema)
      await prisma.vendor.update({
        where: { id: vendorId },
        data: { riskScore: computed.score },
      });

      // Optional: if VendorRiskSnapshot exists, write a snapshot (safe runtime check)
      const prismaAny = prisma as any;
      if (prismaAny?.vendorRiskSnapshot?.create) {
        await prismaAny.vendorRiskSnapshot.create({
          data: {
            organizationId: orgId,
            vendorId,
            score: computed.score,
            
            summary: `Computed from counts: issues=${computed.counts.issues}, requests=${computed.counts.evidenceRequests}, evidence=${computed.counts.evidence}, assessments=${computed.counts.assessments}`,
          },
        });
      }
    }

    results.push(computed);
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    vendorIds,
    results,
  });
}









