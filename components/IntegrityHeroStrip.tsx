"use client";

import { useEffect, useState } from "react";

type BadgeStatus = "ok" | "mismatch" | "unknown";

interface PublicStatus {
  status?: string;
  seal?: string;
  computed?: string;
  expected?: string;
  generatedAt?: string;
  [key: string]: unknown;
}

interface IntegrityState {
  status: BadgeStatus;
  loaded: boolean;
  data?: PublicStatus | null;
}

function normalizeStatus(data: PublicStatus | null): BadgeStatus {
  const raw = data?.status?.toString().toUpperCase();

  if (raw === "OK" || raw === "MATCH" || raw === "PASS") return "ok";
  if (raw === "MISMATCH" || raw === "FAIL" || raw === "FAILED") return "mismatch";

  return "unknown";
}

/**
 * Shared hook: reads /public-status/index.json at runtime
 * and normalizes into ok / mismatch / unknown.
 */
export function useIntegrityStatus(): IntegrityState {
  const [state, setState] = useState<IntegrityState>({
    status: "unknown",
    loaded: false,
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/public-status/index.json", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PublicStatus;

        if (cancelled) return;
        setState({
          status: normalizeStatus(json),
          loaded: true,
          data: json,
        });
      } catch {
        if (cancelled) return;
        setState({
          status: "unknown",
          loaded: true,
          data: null,
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * Hero strip that sits under the navbar on the home page.
 * Reads live badge status via useIntegrityStatus.
 */
export function IntegrityHeroStrip() {
  const { status, loaded } = useIntegrityStatus();

  const isOk = status === "ok";
  const isMismatch = status === "mismatch";

  const pillBg =
    status === "ok"
      ? "bg-emerald-500"
      : status === "mismatch"
      ? "bg-rose-500"
      : "bg-slate-500";

  const pillText =
    status === "ok"
      ? "OK"
      : status === "mismatch"
      ? "Attention"
      : loaded
      ? "Unknown"
      : "Checking€¦";

  const barBg =
    status === "ok"
      ? "bg-emerald-500/10 border-emerald-500/40"
      : status === "mismatch"
      ? "bg-rose-500/10 border-rose-500/40"
      : "bg-slate-500/10 border-slate-500/30";

  const barTitle =
    status === "ok"
      ? "CRYPTOGRAPHICALLY SEALED BUILD"
      : status === "mismatch"
      ? "INTEGRITY WARNING"
      : "INTEGRITY STATUS";

  const barSubtitle =
    status === "ok"
      ? "Hero environment is protected by source-only integrity checks before each deploy."
      : status === "mismatch"
      ? "Latest deploy failed seal verification. Investigate before sharing externally."
      : "Live integrity status could not be confirmed yet.";

  return (
    <div className="w-full rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs text-slate-100 shadow-sm shadow-slate-950/60">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/90 px-2.5 py-1 text-[11px] font-medium">
            <span
              className={`inline-flex h-5 min-w-[40px] items-center justify-center rounded-full px-2 text-[11px] ${pillBg} text-slate-950`}
            >
              {pillText}
            </span>
            <span className="text-slate-300">Integrity</span>
          </div>
          <div
            className={`hidden items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase sm:inline-flex ${barBg}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
            <span className="text-slate-100">{barTitle}</span>
          </div>
        </div>

        <p className="mt-1 max-w-xl text-[11px] text-slate-300 sm:mt-0">
          {barSubtitle}
        </p>
      </div>
    </div>
  );
}

/**
 * Small nav pill for the top-right corner of the header.
 * Uses the same live status as the hero strip.
 */
export function IntegrityNavChip() {
  const { status, loaded } = useIntegrityStatus();

  const isOk = status === "ok";
  const isMismatch = status === "mismatch";

  const dotColor = isOk
    ? "bg-emerald-400"
    : isMismatch
    ? "bg-rose-400"
    : "bg-slate-400";

  const label =
    status === "ok"
      ? "Master seal verified"
      : status === "mismatch"
      ? "Master seal failed"
      : loaded
      ? "Integrity status unknown"
      : "Checking integrity€¦";

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1 text-[11px] text-slate-200">
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      <span className="font-medium text-slate-100">Truvern Integrity</span>
      <span className="text-slate-300">{label}</span>
    </div>
  );
}


