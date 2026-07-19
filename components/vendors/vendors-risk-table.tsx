// components/vendors/vendors-risk-table.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type RiskBreakdown = {
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  INFO: number;
};

export type VendorRiskRowUI = {
  id: number;
  name: string;
  category: string | null;
  updatedAt: string; // ISO
  risk: {
    score: number; // 0..100
    open: number;
    accepted: number;
    resolved: number;
    bySeverityOpen: RiskBreakdown;
    topDrivers: string[];
  };
  trust: {
    evidence: {
      status: "FRESH" | "STALE" | "MISSING";
      ageDays: number | null;
      countRecent: number;
    };
    assessment: {
      status: "RECENT" | "OLD" | "NONE";
      ageDays: number | null;
    };
    posture: { verifiedCandidate: boolean; reasons: string[] };
  };
};

type RiskBucket = "ALL" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
type SortKey = "WORST" | "BEST" | "NAME" | "UPDATED" | "OPEN";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "€”";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function scoreTone(score: number) {
  if (score >= 80)
    return "bg-emerald-500/10 text-emerald-200 border-emerald-500/30";
  if (score >= 60) return "bg-sky-500/10 text-sky-200 border-sky-500/30";
  if (score >= 40)
    return "bg-amber-500/10 text-amber-200 border-amber-500/30";
  return "bg-rose-500/10 text-rose-200 border-rose-500/30";
}

function riskLabel(score: number) {
  if (score >= 80) return "Low";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "High";
  return "Critical";
}

function bucketOf(score: number): Exclude<RiskBucket, "ALL"> {
  if (score >= 80) return "LOW";
  if (score >= 60) return "MODERATE";
  if (score >= 40) return "HIGH";
  return "CRITICAL";
}

function sevChip(n: number, label: string, tone: string) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        tone
      )}
    >
      {label} {n}
    </span>
  );
}

export default function VendorsRiskTable({ rows }: { rows: VendorRiskRowUI[] }) {
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<RiskBucket>("ALL");
  const [sort, setSort] = useState<SortKey>("WORST");
  const [openMin, setOpenMin] = useState<number>(0);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let out = rows;

    if (qq) {
      out = out.filter((r) => {
        const hay = `${r.name} ${r.category ?? ""}`.toLowerCase();
        return hay.includes(qq);
      });
    }

    if (bucket !== "ALL") {
      out = out.filter((r) => bucketOf(r.risk.score) === bucket);
    }

    if (openMin > 0) {
      out = out.filter((r) => (r.risk.open ?? 0) >= openMin);
    }

    out = [...out].sort((a, b) => {
      switch (sort) {
        case "WORST":
          return a.risk.score - b.risk.score; // lowest first
        case "BEST":
          return b.risk.score - a.risk.score;
        case "OPEN":
          return (b.risk.open ?? 0) - (a.risk.open ?? 0);
        case "UPDATED":
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        case "NAME":
          return a.name.localeCompare(b.name);
      }
    });

    return out;
  }, [rows, q, bucket, sort, openMin]);

  const counts = useMemo(() => {
    const c = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
    for (const r of rows) c[bucketOf(r.risk.score)]++;
    return c;
  }, [rows]);

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
      {/* Controls */}
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-full max-w-md">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search vendors€¦"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-200/40 outline-none focus:border-white/20"
            />
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-200/60">
            <span>Defaults:</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
              Worst risk first
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
              Computed from issues
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="WORST">Sort: Worst risk</option>
            <option value="BEST">Sort: Best risk</option>
            <option value="OPEN">Sort: Most open</option>
            <option value="UPDATED">Sort: Recently updated</option>
            <option value="NAME">Sort: Name</option>
          </select>

          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value as RiskBucket)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="ALL">Risk: All ({rows.length})</option>
            <option value="LOW">Risk: Low ({counts.LOW})</option>
            <option value="MODERATE">Risk: Moderate ({counts.MODERATE})</option>
            <option value="HIGH">Risk: High ({counts.HIGH})</option>
            <option value="CRITICAL">Risk: Critical ({counts.CRITICAL})</option>
          </select>

          <select
            value={openMin}
            onChange={(e) => setOpenMin(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
          >
            <option value={0}>Open ‰¥ 0</option>
            <option value={1}>Open ‰¥ 1</option>
            <option value={3}>Open ‰¥ 3</option>
            <option value={5}>Open ‰¥ 5</option>
            <option value={10}>Open ‰¥ 10</option>
          </select>
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-12 gap-3 border-b border-white/10 px-5 py-3 text-xs font-semibold text-slate-200/70">
        <div className="col-span-6">Vendor</div>
        <div className="col-span-2">Risk</div>
        <div className="col-span-2">Open</div>
        <div className="col-span-2 text-right">Updated</div>
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-sm text-slate-200/70">
          No vendors match your filters.
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {filtered.map((r) => {
            const isOpen = !!expanded[r.id];
            const drivers = r.risk.topDrivers.join(", ");
            const tooltip =
              `Score ${r.risk.score}/100 (${riskLabel(r.risk.score)}). ` +
              `Open: ${r.risk.open}, Accepted: ${r.risk.accepted}, Resolved: ${r.risk.resolved}.` +
              (drivers ? ` Drivers: ${drivers}.` : "");

            return (
              <div key={r.id} className="group">
                <div className="grid grid-cols-12 gap-3 px-5 py-4 hover:bg-white/[0.04]">
                  <div className="col-span-6">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/vendors/${r.id}`}
                        className="text-sm font-semibold text-white hover:underline"
                      >
                        {r.name}
                      </Link>

                      {r.risk.score >= 80 && (
                        <span className="hidden sm:inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                          Verified posture
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-200/60">
                      <span className="text-slate-200/60">
                        {r.category ?? "€”"}
                      </span>
                      <span className="opacity-40">€¢</span>
                      <span>{drivers ? drivers : "No major drivers"}</span>

                      <span className="opacity-40">€¢</span>

                      {/* Evidence chip */}
                      <span
                        className={clsx(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          r.trust.evidence.status === "FRESH"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                            : r.trust.evidence.status === "STALE"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                            : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                        )}
                        title={
                          r.trust.evidence.status === "MISSING"
                            ? "No evidence on file"
                            : `Last evidence ${
                                r.trust.evidence.ageDays ?? "?"
                              } days ago €¢ ${
                                r.trust.evidence.countRecent
                              } items in last year`
                        }
                      >
                        Evidence:{" "}
                        {r.trust.evidence.status === "FRESH"
                          ? "Fresh"
                          : r.trust.evidence.status === "STALE"
                          ? "Stale"
                          : "Missing"}
                      </span>

                      {/* Assessment chip */}
                      <span
                        className={clsx(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          r.trust.assessment.status === "RECENT"
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                            : r.trust.assessment.status === "OLD"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                            : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                        )}
                        title={
                          r.trust.assessment.status === "NONE"
                            ? "No assessment recorded"
                            : `Last assessment ${
                                r.trust.assessment.ageDays ?? "?"
                              } days ago`
                        }
                      >
                        Assessment:{" "}
                        {r.trust.assessment.status === "RECENT"
                          ? "Recent"
                          : r.trust.assessment.status === "OLD"
                          ? "Old"
                          : "None"}
                      </span>

                      {/* Candidate seal (not enforcement yet) */}
                      {r.trust.posture.verifiedCandidate && (
                        <span
                          className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-100"
                          title="Candidate: fresh evidence + recent assessment. (Formal seal rules come in Phase 327D.)"
                        >
                          Candidate œ“
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2" title={tooltip}>
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                          scoreTone(r.risk.score)
                        )}
                      >
                        {r.risk.score}
                      </span>
                      <span className="hidden md:inline text-xs text-slate-200/60">
                        {riskLabel(r.risk.score)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-28 max-w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-white/40"
                        style={{
                          width: `${Math.max(2, Math.min(100, r.risk.score))}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm font-semibold text-white">
                      {r.risk.open}
                    </div>
                    <div className="text-xs text-slate-200/60">
                      accepted {r.risk.accepted} €¢ done {r.risk.resolved}
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-3">
                    <div className="text-right text-xs text-slate-200/60">
                      {fmtDate(r.updatedAt)}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                      aria-label={isOpen ? "Collapse" : "Expand"}
                      title={isOpen ? "Collapse" : "Expand"}
                    >
                      {isOpen ? "€“" : "+"}
                    </button>
                  </div>
                </div>

                {/* Expandable drilldown */}
                {isOpen && (
                  <div className="px-5 pb-5">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            Risk drilldown
                          </div>
                          <div className="mt-1 text-xs text-slate-200/60">
                            Computed from open issues by severity. Accepted risk
                            is tracked but does not reduce score.
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {sevChip(
                            r.risk.bySeverityOpen.CRITICAL,
                            "Critical",
                            "border-rose-500/30 bg-rose-500/10 text-rose-200"
                          )}
                          {sevChip(
                            r.risk.bySeverityOpen.HIGH,
                            "High",
                            "border-amber-500/30 bg-amber-500/10 text-amber-200"
                          )}
                          {sevChip(
                            r.risk.bySeverityOpen.MEDIUM,
                            "Medium",
                            "border-sky-500/30 bg-sky-500/10 text-sky-200"
                          )}
                          {sevChip(
                            r.risk.bySeverityOpen.LOW,
                            "Low",
                            "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          )}
                          {sevChip(
                            r.risk.bySeverityOpen.INFO,
                            "Info",
                            "border-white/10 bg-white/5 text-slate-200"
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs font-semibold text-slate-200/70">
                            Score
                          </div>
                          <div className="mt-1 text-xl font-semibold text-white">
                            {r.risk.score}/100
                          </div>
                          <div className="mt-1 text-xs text-slate-200/60">
                            {riskLabel(r.risk.score)} risk
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs font-semibold text-slate-200/70">
                            Open issues
                          </div>
                          <div className="mt-1 text-xl font-semibold text-white">
                            {r.risk.open}
                          </div>
                          <div className="mt-1 text-xs text-slate-200/60">
                            Severity-weighted
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs font-semibold text-slate-200/70">
                            Accepted risk
                          </div>
                          <div className="mt-1 text-xl font-semibold text-white">
                            {r.risk.accepted}
                          </div>
                          <div className="mt-1 text-xs text-slate-200/60">
                            Doesn€™t subtract
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <Link
                          href={`/vendors/${r.id}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                        >
                          View vendor
                        </Link>

                        <div className="text-xs text-slate-200/50">
                          Tip: sort by €œMost open€ to triage quickly.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


