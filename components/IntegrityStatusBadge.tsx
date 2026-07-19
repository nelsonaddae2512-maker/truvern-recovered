"use client";

import { useEffect, useState } from "react";

type IntegrityStatus = "loading" | "ok" | "error";

interface BadgeState {
  status: IntegrityStatus;
  updated?: string;
  rawStatus?: string;
  errorMessage?: string;
}

export function IntegrityStatusBadge({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<BadgeState>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const res = await fetch("/public-status/index.json", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setState({
              status: "error",
              errorMessage: `HTTP ${res.status}`,
            });
          }
          return;
        }

        const data = await res.json();
        const raw = String(data.status || "").toUpperCase();
        const updated = typeof data.updated === "string" ? data.updated : undefined;

        if (!cancelled) {
          setState({
            status: raw === "OK" ? "ok" : "error",
            updated,
            rawStatus: raw,
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setState({
            status: "error",
            errorMessage: err?.message ?? "Unknown error",
          });
        }
      }
    }

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const { status, updated, rawStatus, errorMessage } = state;

  let bgClass =
    "bg-slate-800/80 border border-slate-600/70 text-slate-200";
  let dotClass = "bg-slate-400";
  let label = "Checking integrity€¦";

  if (status === "ok") {
    bgClass = "bg-emerald-500/10 border border-emerald-400/60 text-emerald-200";
    dotClass = "bg-emerald-400";
    label = "Truvern Integrity · Master seal verified";
  } else if (status === "error") {
    bgClass = "bg-rose-500/10 border border-rose-500/60 text-rose-200";
    dotClass = "bg-rose-400";
    label =
      rawStatus && rawStatus !== "OK"
        ? `Truvern Integrity · ${rawStatus}`
        : "Truvern Integrity · Status unavailable";
  }

  const baseClasses =
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] backdrop-blur shadow-sm";

  const containerClass = compact
    ? `${baseClasses} ${bgClass}`
    : `${baseClasses} ${bgClass}`;

  return (
    <div className={containerClass}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      <span className="truncate">{label}</span>
      {status === "ok" && updated && !compact && (
        <span className="hidden text-[10px] text-slate-400 sm:inline">
          Updated {updated}
        </span>
      )}
      {status === "error" && errorMessage && !compact && (
        <span className="hidden text-[10px] text-slate-400 sm:inline">
          ({errorMessage})
        </span>
      )}
    </div>
  );
}


