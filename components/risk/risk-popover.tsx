"use client";

import { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Breakdown = { critical: number; high: number; medium: number; low: number };

function toneFromLabel(label: string) {
  const s = (label || "").toLowerCase();
  if (s.includes("critical")) return "border-rose-400/25 bg-rose-500/10 text-rose-200";
  if (s.includes("high")) return "border-orange-400/25 bg-orange-500/10 text-orange-200";
  if (s.includes("moderate") || s.includes("medium")) return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  if (s.includes("low")) return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  return "border-white/10 bg-white/5 text-white/80";
}

function trendTone(trend: "up" | "down" | "flat") {
  if (trend === "up") return "border-rose-400/25 bg-rose-500/10 text-rose-200";
  if (trend === "down") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  return "border-white/10 bg-white/5 text-white/70";
}

export default function RiskPopover({
  score,
  label,
  breakdown,
  trend,
}: {
  score: number;
  label: string;
  breakdown: Breakdown;
  trend: "up" | "down" | "flat";
}) {
  const [open, setOpen] = useState(false);

  const trendText = useMemo(() => {
    if (trend === "up") return "Rising";
    if (trend === "down") return "Improving";
    return "Stable";
  }, [trend]);

  const totalOpen =
    (breakdown?.critical || 0) +
    (breakdown?.high || 0) +
    (breakdown?.medium || 0) +
    (breakdown?.low || 0);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Trigger */}
      <span
        className={clsx(
          "inline-flex h-6 w-6 items-center justify-center rounded-full",
          "border border-white/10 bg-white/5 text-white/70",
          "hover:bg-white/10 hover:text-white cursor-help select-none",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
        )}
        aria-label="Risk details"
        title="Risk details"
      >
        ⓘ
      </span>

      {open && (
        <div
          className={clsx(
            "absolute left-0 top-full z-50 mt-2 w-[340px]",
            "rounded-2xl border border-white/10 bg-slate-950/85 shadow-2xl backdrop-blur-xl",
            "p-3"
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-white">Risk details</div>
                <span className="pill">
                  Open: <span className="text-white/90 tabular-nums">{totalOpen}</span>
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="pill">
                  Score <span className="text-white/90 tabular-nums">{score}</span>/100
                </span>
                <span className={clsx("rounded-full border px-2.5 py-1 text-[11px] font-medium", toneFromLabel(label))}>
                  {label}
                </span>
                <span className={clsx("rounded-full border px-2.5 py-1 text-[11px] font-medium", trendTone(trend))}>
                  {trendText}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
            <div className="glass-inset p-2 border border-rose-400/20 bg-rose-500/10 text-rose-200">
              <div className="font-semibold">C</div>
              <div className="tabular-nums">{breakdown.critical || 0}</div>
            </div>
            <div className="glass-inset p-2 border border-orange-400/20 bg-orange-500/10 text-orange-200">
              <div className="font-semibold">H</div>
              <div className="tabular-nums">{breakdown.high || 0}</div>
            </div>
            <div className="glass-inset p-2 border border-amber-400/20 bg-amber-500/10 text-amber-200">
              <div className="font-semibold">M</div>
              <div className="tabular-nums">{breakdown.medium || 0}</div>
            </div>
            <div className="glass-inset p-2 border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
              <div className="font-semibold">L</div>
              <div className="tabular-nums">{breakdown.low || 0}</div>
            </div>
          </div>

          {/* Explainer */}
          <div className="mt-3 glass-inset p-3">
            <div className="text-[11px] font-semibold text-white/70">How the score works</div>
            <div className="mt-1 text-xs text-white/55 leading-relaxed">
              We sum open-issue severity points (Critical 10, High 7, Medium 4, Low 1), then map to a 0–100 score (capped).
            </div>
            <div className="mt-1 text-xs text-white/55 leading-relaxed">
              Trend compares recent open-risk points (last 14 days) vs older points.
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

