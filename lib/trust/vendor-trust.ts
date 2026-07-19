// lib/trust/vendor-trust.ts
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type AnyObj = Record<string, any>;

function getDmmf() {
  return (Prisma as any)?.dmmf as AnyObj | undefined;
}

function modelExists(modelName: string) {
  const dmmf = getDmmf();
  return !!dmmf?.datamodel?.models?.find((m: any) => m?.name === modelName);
}

function getModelFieldSet(modelName: string): Set<string> {
  const dmmf = getDmmf();
  const model = dmmf?.datamodel?.models?.find((m: any) => m?.name === modelName);
  const names: string[] = model?.fields?.map((f: any) => f?.name) ?? [];
  return new Set(names.filter(Boolean));
}

function findFirstExistingModel(names: string[]): string | null {
  for (const n of names) if (modelExists(n)) return n;
  return null;
}

function pickFirstField(fields: Set<string>, candidates: string[]): string | null {
  for (const c of candidates) if (fields.has(c)) return c;
  return null;
}

function daysBetween(a: Date, b: Date) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export type VendorTrustSignals = {
  vendorId: number;

  evidence: {
    status: "FRESH" | "STALE" | "MISSING";
    lastEvidenceAt: string | null; // ISO
    ageDays: number | null;
    countRecent: number; // evidence items in last N days (if model exists)
  };

  assessment: {
    status: "RECENT" | "OLD" | "NONE";
    lastAssessmentAt: string | null; // ISO
    ageDays: number | null;
  };

  posture: {
    // Not enforcement yet €” just a €œcandidate€ signal
    // (Phase 327D will formalize Verified/At Risk/Not Verified)
    verifiedCandidate: boolean;
    reasons: string[]; // explainability
  };
};

export async function computeVendorTrustMap(
  vendorIds: number[],
  opts?: { evidenceFreshDays?: number; evidenceRecentWindowDays?: number; assessmentFreshDays?: number }
): Promise<Map<number, VendorTrustSignals>> {
  const evidenceFreshDays = opts?.evidenceFreshDays ?? 180; // 6 months
  const evidenceRecentWindowDays = opts?.evidenceRecentWindowDays ?? 365; // 1 year
  const assessmentFreshDays = opts?.assessmentFreshDays ?? 365; // 1 year

  const out = new Map<number, VendorTrustSignals>();
  const now = new Date();

  for (const vid of vendorIds) {
    out.set(vid, {
      vendorId: vid,
      evidence: { status: "MISSING", lastEvidenceAt: null, ageDays: null, countRecent: 0 },
      assessment: { status: "NONE", lastAssessmentAt: null, ageDays: null },
      posture: { verifiedCandidate: false, reasons: [] },
    });
  }
  if (!vendorIds.length) return out;

  // ---------------- Evidence ----------------
  const evidenceModel = findFirstExistingModel(["Evidence", "VendorEvidence", "EvidenceItem", "Artifact"]);
  if (evidenceModel) {
    const fields = getModelFieldSet(evidenceModel);

    const vendorIdField = pickFirstField(fields, ["vendorId", "vendorID", "VendorId"]);
    const createdField = pickFirstField(fields, ["createdAt", "uploadedAt", "submittedAt"]);
    const updatedField = pickFirstField(fields, ["updatedAt", "receivedAt", "capturedAt"]);

    if (vendorIdField && (createdField || updatedField)) {
      const modelClient = (prisma as any)[evidenceModel];

      const rows: AnyObj[] = await modelClient.findMany({
        where: { [vendorIdField]: { in: vendorIds } },
        select: {
          [vendorIdField]: true,
          ...(createdField ? { [createdField]: true } : {}),
          ...(updatedField ? { [updatedField]: true } : {}),
        },
        take: 10000,
      });

      // latest evidence date + recent counts
      const latestByVendor = new Map<number, Date>();
      const recentCountByVendor = new Map<number, number>();
      const recentCutoff = new Date(now.getTime() - evidenceRecentWindowDays * 86400000);

      for (const r of rows) {
        const vid = Number(r[vendorIdField]);
        if (!Number.isFinite(vid)) continue;

        const dtRaw = (updatedField && r[updatedField]) || (createdField && r[createdField]) || null;
        const dt = dtRaw ? new Date(dtRaw) : null;
        if (!dt || Number.isNaN(dt.getTime())) continue;

        const prev = latestByVendor.get(vid);
        if (!prev || dt.getTime() > prev.getTime()) latestByVendor.set(vid, dt);

        if (dt.getTime() >= recentCutoff.getTime()) {
          recentCountByVendor.set(vid, (recentCountByVendor.get(vid) ?? 0) + 1);
        }
      }

      for (const vid of vendorIds) {
        const s = out.get(vid);
        if (!s) continue;

        const last = latestByVendor.get(vid) ?? null;
        if (!last) continue;

        const age = daysBetween(now, last);
        s.evidence.lastEvidenceAt = last.toISOString();
        s.evidence.ageDays = age;
        s.evidence.countRecent = recentCountByVendor.get(vid) ?? 0;

        s.evidence.status = age <= evidenceFreshDays ? "FRESH" : "STALE";
      }
    }
  }

  // ---------------- Assessments ----------------
  const assessmentModel = findFirstExistingModel([
    "Assessment",
    "AssessmentRun",
    "AssessmentInstance",
    "VendorAssessment",
  ]);
  if (assessmentModel) {
    const fields = getModelFieldSet(assessmentModel);
    const vendorIdField = pickFirstField(fields, ["vendorId", "vendorID", "VendorId"]);
    const createdField = pickFirstField(fields, ["createdAt", "startedAt"]);
    const updatedField = pickFirstField(fields, ["updatedAt", "completedAt", "endedAt"]);

    if (vendorIdField && (createdField || updatedField)) {
      const modelClient = (prisma as any)[assessmentModel];

      const rows: AnyObj[] = await modelClient.findMany({
        where: { [vendorIdField]: { in: vendorIds } },
        select: {
          [vendorIdField]: true,
          ...(createdField ? { [createdField]: true } : {}),
          ...(updatedField ? { [updatedField]: true } : {}),
        },
        take: 10000,
      });

      const latestByVendor = new Map<number, Date>();

      for (const r of rows) {
        const vid = Number(r[vendorIdField]);
        if (!Number.isFinite(vid)) continue;

        const dtRaw = (updatedField && r[updatedField]) || (createdField && r[createdField]) || null;
        const dt = dtRaw ? new Date(dtRaw) : null;
        if (!dt || Number.isNaN(dt.getTime())) continue;

        const prev = latestByVendor.get(vid);
        if (!prev || dt.getTime() > prev.getTime()) latestByVendor.set(vid, dt);
      }

      for (const vid of vendorIds) {
        const s = out.get(vid);
        if (!s) continue;

        const last = latestByVendor.get(vid) ?? null;
        if (!last) continue;

        const age = daysBetween(now, last);
        s.assessment.lastAssessmentAt = last.toISOString();
        s.assessment.ageDays = age;
        s.assessment.status = age <= assessmentFreshDays ? "RECENT" : "OLD";
      }
    }
  }

  // ---------------- Posture candidate (non-enforcing) ----------------
  // Candidate if evidence is FRESH and assessment is RECENT (or present & not too old).
  for (const vid of vendorIds) {
    const s = out.get(vid);
    if (!s) continue;

    const reasons: string[] = [];

    if (s.evidence.status === "MISSING") reasons.push("No evidence on file");
    else if (s.evidence.status === "STALE") reasons.push("Evidence stale");

    if (s.assessment.status === "NONE") reasons.push("No assessment recorded");
    else if (s.assessment.status === "OLD") reasons.push("Assessment old");

    const candidate =
      s.evidence.status === "FRESH" && (s.assessment.status === "RECENT");

    s.posture.verifiedCandidate = candidate;
    s.posture.reasons = reasons.slice(0, 3);
  }

  return out;
}




