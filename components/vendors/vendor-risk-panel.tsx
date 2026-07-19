"use client";

import Link from "next/link";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Breakdown = { critical: number; high: number; medium: number; low: number };
type Counts = { assessments: number; openIssues: number; evidence: number; evidenceRequests: number };

type TopIssue = {
  id: number;
  title: string;
  severity: string;
  status: string;
};

export default function VendorRiskPanel(props: {
  vendorName: string;
  score: number;
  trend: "up" | "down" | "flat";
  breakdown: Breakdown;
  counts: Counts;
  topOpenIssues: TopIssue[];
}) {
  const { vendorName, score, trend, breakdown, counts, topOpenIssues } = props;

  const level = score >= 80 ? "Critical" : score >= 60 ? "High" : score >= 35 ? "Medium" : "Low";
  const trendLabel = trend === "up" ? "Rising" : trend === "down" ? "Falling" : "Stable";

  const pillTone =
    level === "Critical"
      ? "bg-rose-500/15 text-rose-200 border-rose-500/25"
      : level === "High"
      ? "bg-amber-500/15 text-amber-200 border-amber-500/25"
      : level === "Medium"
      ? "bg-sky-500/15 text-sky-200 border-sky-500/25"
      : "bg-emerald-500/15 text-emerald-200 border-emerald-500/25";

  function SevTag({ sev }: { sev: string }) {
    const s = (sev || "").toUpperCase();
    const c =
      s === "CRITICAL"
        ? "bg-rose-500/15 text-rose-200 border-rose-500/25"
        : s === "HIGH"
        ? "bg-amber-500/15 text-amber-200 border-amber-500/25"
        : s === "MEDIUM"
        ? "bg-sky-500/15 text-sky-200 border-sky-500/25"
        : "bg-slate-500/15 text-slate-200 border-slate-500/25";
    return (
      <span className={clsx("rounded-full border px-2 py-0.5 text-[11px] font-medium", c)}>
        {s || "MEDIUM"}
      </span>
    );
  }

  const totalIssues =
    (breakdown.critical || 0) +
    (breakdown.high || 0) +
    (breakdown.medium || 0) +
    (breakdown.low || 0);

  const evidencePct = counts.evidenceRequests
    ? Math.min(100, (counts.evidence / Math.max(1, counts.evidenceRequests)) * 100)
    : 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-3 md:p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-white/50">Vendor</div>
          <h1 className="truncate text-xl font-semibold text-white">{vendorName}</h1>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={clsx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs", pillTone)}>
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
              {level} · {score}
            </span>
            <span className="text-xs text-white/50">†’ {trendLabel}</span>

            {/* Compact breakdown pills */}
            <span className="ml-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
              C · {breakdown.critical || 0}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
              H · {breakdown.high || 0}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
              M · {breakdown.medium || 0}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
              L · {breakdown.low || 0}
            </span>
          </div>
        </div>

        {/* Counts (tight) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[11px] text-white/50">Assessments</div>
            <div className="mt-0.5 text-lg font-semibold text-white">{counts.assessments}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[11px] text-white/50">Open issues</div>
            <div className="mt-0.5 text-lg font-semibold text-white">{counts.openIssues}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[11px] text-white/50">Evidence</div>
            <div className="mt-0.5 text-lg font-semibold text-white">{counts.evidence}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[11px] text-white/50">Requests</div>
            <div className="mt-0.5 text-lg font-semibold text-white">{counts.evidenceRequests}</div>
          </div>
        </div>
      </div>

      {/* Mid panels (tighter, 2-col) */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Evidence completeness */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Evidence completeness</h3>
            <span className="text-xs text-white/40">
              {counts.evidence}/{counts.evidenceRequests || 0}{" "}
              {counts.evidenceRequests ? `(${Math.round(evidencePct)}%)` : ""}
            </span>
          </div>

          <div className="mt-2 h-2 w-full rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-white/30" style={{ width: `${evidencePct}%` }} />
          </div>

          <p className="mt-1.5 text-[11px] text-white/50">Track submissions vs requested evidence.</p>

          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/evidence"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
            >
              Go to evidence
            </Link>
            <Link
              href="/vendor-portal"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
            >
              Vendor portal
            </Link>
          </div>
        </div>

        {/* Top open issues (shorter internal scroll) */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Top open issues</h3>
            <span className="text-xs text-white/40">Highest severity first</span>
          </div>

          <div className="mt-2 max-h-28 overflow-auto pr-1">
            {topOpenIssues.length === 0 ? (
              <div className="text-sm text-white/50">No open issues found.</div>
            ) : (
              <ul className="space-y-2">
                {topOpenIssues.slice(0, 6).map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-3 rounded-lg bg-black/20 p-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{it.title}</div>
                      <div className="mt-0.5 text-[11px] text-white/40">{it.status}</div>
                    </div>
                    <SevTag sev={it.severity} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-2">
            <Link
              href="/issues"
              className="inline-flex rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
            >
              View all issues
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-white/40">
        Risk level: {level}. Score is computed from open issue severity points{totalIssues ? ` (${totalIssues} open)` : ""}.
      </div>
    </section>
  );
}



