"use client";

import { useMemo, useState } from "react";

type VendorSummary = {
  id: number;
  name: string;
  riskScore: number | null;
  tier?: string | null;
  riskTrend30d?: string | null;
  riskTrend90d?: string | null;
  assessments: number;
  evidence: number;
  createdAt: string;
};

type PortfolioStats = {
  totalVendors: number;
  avgRisk: number;
  totalAssessments: number;
  totalEvidence: number;
  vendorsWithAssessments: number;
  vendorsWithEvidence: number;
  riskBuckets: {
    strong: number;
    moderate: number;
    weak: number;
    unknown: number;
  };
  tierCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    unspecified: number;
  };
  trendCounts: {
    improving: number;
    declining: number;
    stable: number;
    newVendors: number;
  };
};

type RiskAlert = {
  id: number;
  vendorId: number;
  vendorName: string;
  type: string;
  message: string;
  createdAt: string;
};

type Props = {
  stats: PortfolioStats;
  vendors: VendorSummary[];
  topRiskiest: VendorSummary[];
  topStrongest: VendorSummary[];
  alerts: RiskAlert[];
};

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function percent(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function trendChipClasses(trend: string | null | undefined): string {
  const t = (trend ?? "NEW").toUpperCase();
  if (t === "IMPROVING")
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";
  if (t === "DECLINING")
    return "bg-rose-500/10 text-rose-300 border-rose-500/40";
  if (t === "STABLE")
    return "bg-amber-500/10 text-amber-300 border-amber-500/40";
  return "bg-slate-800/80 text-slate-300 border-slate-700/80";
}

export default function VendorPortfolioDashboard({
  stats,
  vendors,
  topRiskiest,
  topStrongest,
  alerts,
}: Props) {
  const [riskFilter, setRiskFilter] = useState<
    "ALL" | "STRONG" | "MODERATE" | "WEAK"
  >("ALL");

  const filtered = useMemo(() => {
    if (riskFilter === "ALL") return vendors;
    return vendors.filter((v) => {
      const score = v.riskScore;
      if (score == null) return false;
      if (riskFilter === "STRONG") return score >= 80;
      if (riskFilter === "MODERATE") return score >= 50 && score < 80;
      if (riskFilter === "WEAK") return score < 50;
      return true;
    });
  }, [vendors, riskFilter]);

  const criticalAlertCount = alerts.length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header with alert badge + export buttons */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-400">
            Truvern Portfolio
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50 sm:text-3xl">
            Vendor Portfolio Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Portfolio-level view of your third-party risk posture. Use this to
            brief executives, audit committees, and program owners on where
            attention is needed.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {criticalAlertCount > 0 && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 px-4 py-2 text-xs text-rose-100 shadow shadow-rose-900/60">
              <p className="font-semibold">
                {criticalAlertCount} risk alert
                {criticalAlertCount > 1 ? "s" : ""} require attention
              </p>
              <p className="mt-1 text-[11px] text-rose-100/80">
                See the &quot;Attention required&quot; panel below for details.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <a
              href="/api/reports/portfolio/export/csv"
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-100 hover:border-emerald-500/60 hover:text-emerald-200"
            >
              Download CSV
            </a>
            <a
              href="/api/reports/portfolio/export/pdf"
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-100 hover:border-emerald-500/60 hover:text-emerald-200"
            >
              Executive PDF
            </a>
          </div>
        </div>
      </header>

      {/* (rest of component unchanged €“ Attention panel, distribution, table, top lists) */}
      {/* ... keep exactly what you already have from the previous version for sections below ... */}
      {/* For brevity: if easier, you can keep the entire rest of the file from the last patch. */}
    </div>
  );
}


