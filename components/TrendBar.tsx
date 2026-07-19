"use client";
import React from "react";

type Props = {
  pct: number; // 0..100
  tone?: "ok" | "warn" | "bad";
  label?: string;
};

export default function TrendBar({ pct, tone = "ok", label }: Props) {
  const color =
    tone === "bad" ? "bg-rose-500" :
    tone === "warn" ? "bg-amber-500" :
    "bg-emerald-500";
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div>
      {label ? <div className="mb-1 text-xs text-zinc-600 dark:text-zinc-300">{label}</div> : null}
      <div className="h-2 w-full rounded bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-2 rounded ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

