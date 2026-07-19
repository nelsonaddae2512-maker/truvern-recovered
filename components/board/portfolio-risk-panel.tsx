// components/board/portfolio-risk-panel.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

export type BoardVendorRiskRow = {
  vendorId: number;
  name: string;
  updatedAt?: any;
  category?: string | null;

  score: number;
  open: number;
  accepted?: number;
  resolved?: number;

  bySeverityOpen?: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number; INFO: number };
  topDrivers?: string[];
};

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function safeDrivers(x: BoardVendorRiskRow["topDrivers"]): string[] {
  return Array.isArray(x) ? x.filter(Boolean).map(String) : [];
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function riskLabel(score: number) {
  const s = clamp(Number(score ?? 0), 0, 100);
  if (s >= 90) return "Low";
  if (s >= 70) return "Moderate";
  if (s >= 45) return "High";
  return "Critical";
}

function scoreTone(score: number) {
  const s = clamp(Number(score ?? 0), 0, 100);
  // Note: in your system, lower score = worse risk (Critical). Tone reflects that.
  if (s >= 90) return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  if (s >= 70) return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  if (s >= 45) return "border-orange-400/25 bg-orange-500/10 text-orange-200";
  return "border-rose-400/25 bg-rose-500/10 text-rose-200";
}

export default function PortfolioRiskPanel({
  rows,
}: {
  rows: BoardVendorRiskRow[] | undefined | null;
}) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const worst = useMemo(() => {
    return [...safeRows]
      .sort((a, b) => {
        const sa = Number(a.score ?? 100);
        const sb = Number(b.score ?? 100);
        if (sa !== sb) return sa - sb; // lower score first (worse)
        return Number(b.open ?? 0) - Number(a.open ?? 0);
      })
      .slice(0, 12);
  }, [safeRows]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-3 glass-soft p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-white">Worst vendors</div>
              <span className="pill">{worst.length} shown</span>
            </div>
            <div className="mt-1 text-xs text-white/50">
              Prioritized by lowest score, then highest open actionable issues.
            </div>
          </div>

          <Link href="/vendors" className="btn-glass">
            View all vendors
          </Link>
        </div>

        <div className="mt-4 divide-y divide-white/10">
          {worst.map((r, idx) => {
            const vid = Number((r as any).vendorId);
            const vendorHref = Number.isFinite(vid) ? `/vendors/${vid}` : "/vendors";
            const findingsHref = Number.isFinite(vid) ? `/vendors/${vid}/findings?status=OPEN` : "/vendors";

            const drivers = safeDrivers(r.topDrivers);
            const label = riskLabel(r.score);
            const tone = scoreTone(r.score);

            return (
              <div key={String(r.vendorId)} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="pill shrink-0">
                        #{idx + 1}
                      </span>

                      <Link
                        href={vendorHref}
                        prefetch={false}
                        className="truncate text-sm font-semibold text-white hover:underline"
                        title={r.name}
                      >
                        {r.name}
                      </Link>

                      {r.category ? (
                        <span className="pill hidden sm:inline-flex">
                          {String(r.category)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 text-xs text-white/60">
                      {Number(r.open ?? 0) > 0 ? (
                        <Link href={findingsHref} prefetch={false} className="hover:underline text-sky-200/90">
                          open {r.open}
                        </Link>
                      ) : (
                        <span>open 0</span>
                      )}

                      {Number(r.accepted ?? 0) > 0 ? (
                        <span className="ml-2 text-white/50">• {r.accepted} accepted</span>
                      ) : null}

                      {Number(r.resolved ?? 0) > 0 ? (
                        <span className="ml-2 text-white/50">• {r.resolved} resolved</span>
                      ) : null}
                    </div>

                    {drivers.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {drivers.slice(0, 6).map((d, i) => (
                          <span key={`${r.vendorId}-drv-${i}`} className="pill">
                            {d}
                          </span>
                        ))}
                        {drivers.length > 6 ? (
                          <span className="pill">+{drivers.length - 6} more</span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-white/40">
                        No top drivers available.
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span className={clsx("rounded-full border px-3 py-1 text-xs font-semibold tabular-nums", tone)}>
                      {Math.round(Number(r.score ?? 0))}
                    </span>
                    <span className="text-xs text-white/60">{label}</span>
                  </div>
                </div>

                {/* subtle inset row to add Trust Network depth */}
                <div className="mt-3 glass-inset p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-white/60">
                      Vendor ID: <span className="text-white/80 tabular-nums">{Number.isFinite(vid) ? vid : "€”"}</span>
                    </div>
                    <div className="text-white/60">
                      Action:
                      <Link href={vendorHref} className="ml-2 text-sky-200/90 hover:underline" prefetch={false}>
                        View vendor †’
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {worst.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/60">No vendors found.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}




