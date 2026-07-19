// app/api/risk-snapshots/compute-score/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* -------------------------------------------------------------------------- */
/* Utils                                                                      */
/* -------------------------------------------------------------------------- */

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isTrue(v: unknown) {
  if (typeof v === "boolean") return v;
  const s = safeStr(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

type Body =
  | {
      vendorId?: unknown;
      dryRun?: unknown;
      // optional: allow forcing snapshot create even if one exists
      forceNewSnapshot?: unknown;
    }
  | null
  | undefined;

function riskLabel(score?: number | null) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "€”";
  if (score >= 80) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

/* -------------------------------------------------------------------------- */
/* Core scoring                                                               */
/* -------------------------------------------------------------------------- */

async function computeScoreForVendor(orgId: number, vendorId: number) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, organizationId: orgId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      riskScore: true,
      
      _count: {
        select: {
          issues: true,
          evidenceRequests: true,
          evidence: true,
          assessments: true,
        },
      },
    },
  });

  if (!vendor) {
    return { ok: false as const, error: "not_found", vendorId };
  }

  // Stable heuristic (schema-safe):
  const issues = vendor._count.issues || 0;
  const reqs = vendor._count.evidenceRequests || 0;
  const evid = vendor._count.evidence || 0;
  const asses = vendor._count.assessments || 0;

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
    vendorId: vendor.id,
    vendorName: vendor.name,
    score,
    counts: { issues, evidenceRequests: reqs, evidence: evid, assessments: asses },
    previousRiskScore: vendor.riskScore ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Snapshot helpers (matches your Prisma schema)                              */
/* VendorRiskSnapshot fields in your schema:                                  */
/* score, label, summary, details, sealedAt, sealedHash, createdAt, updatedAt */
/* -------------------------------------------------------------------------- */

async function getLatestSnapshot(orgId: number, vendorId: number) {
  return prisma.vendorRiskSnapshot.findFirst({
    where: { vendorId },
    orderBy: { id: "desc" },
    select: { id: true, vendorId: true, score: true,   },
  });
}

async function ensureSnapshot(
  orgId: number,
  vendorId: number,
  score: number,
  forceNew: boolean
): Promise<{ snap: { id: number; vendorId: number }; created: boolean }> {
  // œ… FIX: no archivedAt / takenAt in your schema.
  // We consider "active" to be simply the latest snapshot row.
  if (!forceNew) {
    const existing = await getLatestSnapshot(orgId, vendorId);
    if (existing) {
      return { snap: { id: existing.id, vendorId: existing.vendorId }, created: false };
    }
  }

  const created = await prisma.vendorRiskSnapshot.create({
    data: {
      vendorId,
      score,
      // details left null (Json?) unless you want to store more
    },
    select: { id: true, vendorId: true },
  });

  return { snap: created, created: true };
}

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

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

  const vendorId = num((body as any)?.vendorId);
  if (!vendorId) {
    return NextResponse.json({ ok: false, error: "Missing vendorId" }, { status: 400 });
  }

  const dryRun = isTrue((body as any)?.dryRun);
  const forceNewSnapshot = isTrue((body as any)?.forceNewSnapshot);

  const computed = await computeScoreForVendor(orgId, vendorId);
  if (!computed.ok) {
    return NextResponse.json({ ok: false, error: "Vendor not found" }, { status: 404 });
  }

  // Update vendor riskScore (exists in your schema)
  if (!dryRun) {
    await prisma.vendor.update({
      where: { id: vendorId },
      data: { riskScore: computed.score },
    });
  }

  // Snapshot create (or reuse latest)
  let snapshot: { id: number; vendorId: number } | null = null;
  let snapshotCreated = false;

  if (!dryRun) {
    const ensured = await ensureSnapshot(orgId, vendorId, computed.score, forceNewSnapshot);
    snapshot = ensured.snap;
    snapshotCreated = ensured.created;
  }

  const latest = await getLatestSnapshot(orgId, vendorId).catch(() => null);

  return NextResponse.json({
    ok: true,
    dryRun,
    vendorId,
    vendorName: computed.vendorName,
    score: computed.score,
    
    counts: computed.counts,
    previousRiskScore: computed.previousRiskScore,
    snapshot,
    snapshotCreated,
    latestSnapshot: latest,
  });
}









