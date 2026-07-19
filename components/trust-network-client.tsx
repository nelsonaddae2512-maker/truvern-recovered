"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type VendorCounts = {
  assessments: number;
  evidence: number;
};

type TrustNetworkVendor = {
  id: number;
  name: string;
  riskScore: number | null;
  createdAt: string;
  summary?: string | null;
  _count: VendorCounts;
};

type Stats = {
  liveCount: number;
  avgHealth: number;
  evidenceItems: number;
};

type Props = {
  vendors: TrustNetworkVendor[];
  stats: Stats;
};

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function riskLabel(score: number | null): {
  label: string;
  tone: "strong" | "moderate" | "weak" | "unknown";
} {
  if (score == null) return { label: "Unknown", tone: "unknown" };
  if (score >= 80) return { label: "Strong", tone: "strong" };
  if (score >= 50) return { label: "Moderate", tone: "moderate" };
  return { label: "Weak", tone: "weak" };
}

function toneClasses(tone: ReturnType<typeof riskLabel>["tone"]) {
  switch (tone) {
    case "strong":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    case "moderate":
      return "bg-amber-500/10 text-amber-300 border-amber-500/30";
    case "weak":
      return "bg-rose-500/10 text-rose-300 border-rose-500/30";
    default:
      return "bg-slate-700/40 text-slate-300 border-slate-600/60";
  }
}

const TIER_OPTIONS = [
  { value: "ALL", label: "All tiers" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const RISK_FILTERS = [
  { value: "ALL", label: "All risk levels" },
  { value: "STRONG", label: "Strong (80+)" },
  { value: "MODERATE", label: "Moderate (50€“79)" },
  { value: "WEAK", label: "Weak (<50)" },
];

export default function TrustNetworkClient({ vendors, stats }: Props) {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<string>("ALL");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      const searchMatch =
        !search ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        (v.summary ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());

      const tierValue = (v as any).tier as
        | "CRITICAL"
        | "HIGH"
        | "MEDIUM"
        | "LOW"
        | undefined;

      const tierMatch =
        tier === "ALL" || tierValue === tier || (!tierValue && tier === "ALL");

      const r = riskLabel(v.riskScore);
      const riskMatch =
        riskFilter === "ALL" ||
        (riskFilter === "STRONG" && r.tone === "strong") ||
        (riskFilter === "MODERATE" && r.tone === "moderate") ||
        (riskFilter === "WEAK" && r.tone === "weak");

      return searchMatch && tierMatch && riskMatch;
    });
  }, [vendors, search, tier, riskFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header + stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Truvern Trust Network
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50 sm:text-3xl">
            Public Vendor Trust Network
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Browse vendors who publish a Truvern Trust Profile. High-level
            security posture and evidence counts are shared publicly; detailed
            assessments remain private in the Truvern workspace.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/trust-network/export"
            className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm hover:bg-slate-800/80"
          >
            <span className="mr-1.5">‡©</span>
            Export CSV
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Vendors live on network"
          value={stats.liveCount}
          helper="Vendors with at least one Trust Profile."
        />
        <StatCard
          label="Average risk score"
          value={
            stats.liveCount === 0 ? "€”" : `${stats.avgHealth.toString()} / 100`
          }
          helper="Aggregate health across all listed vendors."
        />
        <StatCard
          label="Evidence items"
          value={stats.evidenceItems}
          helper="Reports, policies, and artefacts linked to vendors."
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-400">
            Search
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by vendor name or summary€¦"
            className="mt-1 w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
          />
        </div>

        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
          <div>
            <label className="text-xs font-medium text-slate-400">
              Tier
            </label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-50 focus:border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400">
              Risk level
            </label>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-50 focus:border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
            >
              {RISK_FILTERS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Vendor grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((vendor) => {
          const risk = riskLabel(vendor.riskScore);
          const tierValue = (vendor as any).tier as
            | "CRITICAL"
            | "HIGH"
            | "MEDIUM"
            | "LOW"
            | undefined;

          const tierLabel =
            tierValue === "CRITICAL"
              ? "Critical"
              : tierValue === "HIGH"
              ? "High"
              : tierValue === "MEDIUM"
              ? "Medium"
              : tierValue === "LOW"
              ? "Low"
              : "Unspecified";

          return (
            <div
              key={vendor.id}
              className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm shadow-slate-950/60 transition hover:border-emerald-500/40 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-emerald-500/10"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-semibold text-emerald-300">
                  {vendor.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-50">
                      {vendor.name}
                    </h2>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses(
                        risk.tone
                      )}`}
                    >
                      {risk.label}
                      {typeof vendor.riskScore === "number" &&
                        ` · ${vendor.riskScore}`}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                    {vendor.summary ??
                      "High-level security posture shared via Truvern Trust Profile."}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
                      Tier: {tierLabel}
                    </span>
                    <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
                      Assessments: {vendor._count.assessments}
                    </span>
                    <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
                      Evidence: {vendor._count.evidence}
                    </span>
                    <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
                      Joined: {formatDate(vendor.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
                <p className="text-[11px] text-slate-500">
                  Public profile powered by Truvern.
                </p>
                <Link
                  href={`/trust/${vendor.id}`}
                  className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-50 transition group-hover:border-emerald-500/60 group-hover:text-emerald-200"
                >
                  View Trust Profile
                </Link>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-950/80 p-6 text-center text-sm text-slate-400">
            No vendors match your filters yet. Try clearing search or filters.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard(props: {
  label: string;
  value: number | string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
        {props.label}
      </p>
      <p className="mt-2 text-xl font-semibold text-slate-50">
        {props.value}
      </p>
      {props.helper && (
        <p className="mt-1 text-xs text-slate-500">{props.helper}</p>
      )}
    </div>
  );
}


