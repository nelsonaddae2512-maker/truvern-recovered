// lib/risk/vendor-risk.ts
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

function enumValues(enumName: string): string[] {
  const dmmf = getDmmf();
  const e = dmmf?.datamodel?.enums?.find((x: any) => x?.name === enumName);
  const vals: string[] = e?.values?.map((v: any) => v?.name).filter(Boolean) ?? [];
  return vals;
}

function pickEnumName(candidates: string[]): string | null {
  const dmmf = getDmmf();
  const existing = new Set((dmmf?.datamodel?.enums ?? []).map((e: any) => e?.name));
  for (const c of candidates) if (existing.has(c)) return c;
  return null;
}

function normalizeSeverity(raw: any): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO" {
  const s = String(raw ?? "").toUpperCase();
  if (s.includes("CRIT")) return "CRITICAL";
  if (s.includes("HIGH")) return "HIGH";
  if (s.includes("MED")) return "MEDIUM";
  if (s.includes("LOW")) return "LOW";
  return "INFO";
}

/**
 * Phase 327B Step 1:
 * Robust accepted-risk detection. We avoid relying only on substring "ACCEPT"
 * because schemas sometimes encode accepted statuses differently.
 */
function acceptedStatusSetFromDmmf(): Set<string> {
  const candidates = ["ACCEPTED", "ACCEPTED_RISK", "RISK_ACCEPTED", "ACCEPTEDRISK"];

  // Try to detect an actual status enum name in this project
  const enumName =
    pickEnumName(["IssueStatus", "FindingStatus", "RiskStatus"]) ??
    pickEnumName(["IssueState", "FindingState", "RiskState"]);

  if (!enumName) return new Set(candidates);

  const vals = enumValues(enumName).map((v) => String(v).toUpperCase());
  const set = new Set<string>();

  for (const c of candidates) {
    if (vals.includes(c)) set.add(c);
  }

  // If the enum exists but didn't contain our candidates, still keep safe fallbacks.
  if (set.size === 0) {
    for (const c of candidates) set.add(c);
  }

  return set;
}

const __ACCEPTED_SET = acceptedStatusSetFromDmmf();

function isAcceptedStatus(raw: any): boolean {
  const s = String(raw ?? "").toUpperCase();
  if (!s) return false;

  // Exact known variants
  if (__ACCEPTED_SET.has(s)) return true;

  // Heuristic: covers values like "ACCEPTED_RISK_PENDING_REVIEW" etc.
  if (s.includes("ACCEPT") && s.includes("RISK")) return true;

  // Generic accept heuristic (kept last so it doesn't overmatch)
  if (s.includes("ACCEPT")) return true;

  return false;
}

function statusBucket(raw: any): "OPEN" | "ACCEPTED" | "RESOLVED" {
  const s = String(raw ?? "").toUpperCase();

  // œ… accepted must never be treated as open-ish
  if (isAcceptedStatus(s)) return "ACCEPTED";

  if (s.includes("RESOLV") || s.includes("CLOSED") || s.includes("DONE")) return "RESOLVED";

  // treat everything else as open-ish (OPEN, IN_PROGRESS, TRIAGED, etc.)
  return "OPEN";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export type VendorRiskRow = {
  vendorId: number;
  score: number; // 0..100
  open: number;
  accepted: number;
  resolved: number;
  bySeverityOpen: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number; INFO: number };
  topDrivers: string[]; // explainability strings
};

export async function computeVendorRiskMap(vendorIds: number[]): Promise<Map<number, VendorRiskRow>> {
  const result = new Map<number, VendorRiskRow>();
  if (!vendorIds.length) return result;

  // Prefer Issue model; fall back to Finding if your schema uses that naming.
  const issueModelName = findFirstExistingModel(["Issue", "Finding", "VendorIssue", "VendorFinding"]);
  if (!issueModelName) {
    // If there is no issues/findings model, return neutral risk.
    for (const id of vendorIds) {
      result.set(id, {
        vendorId: id,
        score: 100,
        open: 0,
        accepted: 0,
        resolved: 0,
        bySeverityOpen: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
        topDrivers: [],
      });
    }
    return result;
  }

  const fields = getModelFieldSet(issueModelName);
  const has = (f: string) => fields.has(f);

  // Determine the vendor foreign key field name.
  const vendorIdField =
    (has("vendorId") && "vendorId") ||
    (has("vendorID") && "vendorID") ||
    (has("VendorId") && "VendorId") ||
    null;

  if (!vendorIdField) {
    // No FK -> cannot compute per vendor
    for (const id of vendorIds) {
      result.set(id, {
        vendorId: id,
        score: 100,
        open: 0,
        accepted: 0,
        resolved: 0,
        bySeverityOpen: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
        topDrivers: [],
      });
    }
    return result;
  }

  const severityField =
    (has("severity") && "severity") ||
    (has("Severity") && "Severity") ||
    (has("level") && "level") ||
    null;

  const statusField =
    (has("status") && "status") ||
    (has("Status") && "Status") ||
    (has("state") && "state") ||
    null;

  // Pull a bounded set of issues for these vendors and compute scores in JS.
  // NOTE: if you have huge issue volumes, we can upgrade to pagination/groupBy later.
  const select: AnyObj = { [vendorIdField]: true };
  if (severityField) select[severityField] = true;
  if (statusField) select[statusField] = true;

  // Use dynamic access to prisma[model]
  const modelClient = (prisma as any)[issueModelName];
  const issues: AnyObj[] = await modelClient.findMany({
    where: { [vendorIdField]: { in: vendorIds } },
    select,
    take: 5000,
    orderBy: has("updatedAt") ? { updatedAt: "desc" } : has("createdAt") ? { createdAt: "desc" } : undefined,
  });

  // Initialize per vendor
  for (const id of vendorIds) {
    result.set(id, {
      vendorId: id,
      score: 100,
      open: 0,
      accepted: 0,
      resolved: 0,
      bySeverityOpen: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
      topDrivers: [],
    });
  }

  // Count & severity breakdown
  for (const it of issues) {
    const vid = Number(it[vendorIdField]);
    if (!Number.isFinite(vid)) continue;
    const row = result.get(vid);
    if (!row) continue;

    const sev = normalizeSeverity(severityField ? it[severityField] : "INFO");
    const bucket = statusBucket(statusField ? it[statusField] : "OPEN");

    if (bucket === "OPEN") {
      row.open += 1;
      row.bySeverityOpen[sev] += 1;
    } else if (bucket === "ACCEPTED") {
      row.accepted += 1;
    } else {
      row.resolved += 1;
    }
  }

  // Score formula (explainable):
  // Start at 100, subtract penalties for OPEN items by severity.
  // Accepted risk does not subtract (but we report it).
  const weights: Record<string, number> = {
    CRITICAL: 15,
    HIGH: 10,
    MEDIUM: 6,
    LOW: 3,
    INFO: 1,
  };

  for (const [vid, row] of result.entries()) {
    const penalty =
      row.bySeverityOpen.CRITICAL * weights.CRITICAL +
      row.bySeverityOpen.HIGH * weights.HIGH +
      row.bySeverityOpen.MEDIUM * weights.MEDIUM +
      row.bySeverityOpen.LOW * weights.LOW +
      row.bySeverityOpen.INFO * weights.INFO;

    row.score = clamp(100 - penalty, 0, 100);

    const drivers: string[] = [];
    if (row.bySeverityOpen.CRITICAL) drivers.push(`${row.bySeverityOpen.CRITICAL} critical open`);
    if (row.bySeverityOpen.HIGH) drivers.push(`${row.bySeverityOpen.HIGH} high open`);
    if (row.bySeverityOpen.MEDIUM) drivers.push(`${row.bySeverityOpen.MEDIUM} medium open`);
    if (row.accepted) drivers.push(`${row.accepted} accepted risk`);
    row.topDrivers = drivers.slice(0, 3);
  }

  return result;
}




