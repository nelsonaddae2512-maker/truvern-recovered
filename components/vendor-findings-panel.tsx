// components/vendor-findings-panel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import IssueInboxTable from "@/components/issue-inbox-table";

type IssueRow = {
  id: number;
  title: string;
  severity: string;
  status: string;
  vendor?: { id: number; name: string } | null;
  assessment?: { id: number; title?: string | null } | null;
  createdAt: string | Date;
};

type TabKey = "open" | "accepted" | "accepted";

async function safeJson(res: Response) {
  const txt = await res.text().catch(() => "");
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return { ok: false, error: txt };
  }
}

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function VendorFindingsPanel({ vendorId }: { vendorId: number }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [tab, setTab] = useState<TabKey>("open");
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr(null);
      try {
        // Phase 324B: vendor issues endpoint returns ALL statuses unless filtered
        const r = await fetch(`/api/vendors/${vendorId}/issues`, {
          method: "GET",
          credentials: "include",
        });
        const data = await safeJson(r);
        if (!r.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);

        const issues = Array.isArray(data?.issues) ? data.issues : [];
        if (!alive) return;

        // Normalize lightly (table handles display)
        const normalized: IssueRow[] = issues.map((x: any) => ({
          id: Number(x?.id),
          title: String(x?.title ?? x?.name ?? `Issue #${x?.id ?? "?"}`),
          severity: String(x?.severity ?? "MEDIUM"),
          status: String(x?.status ?? "OPEN"),
          vendor: x?.vendor
            ? { id: Number(x.vendor.id), name: String(x.vendor.name ?? "Vendor") }
            : null,
          assessment: x?.assessment
            ? { id: Number(x.assessment.id), title: x.assessment.title ?? null }
            : null,
          createdAt: x?.createdAt ?? new Date().toISOString(),
        }));

        setRows(normalized.filter((i) => Number.isFinite(i.id)));
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load vendor issues");
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (Number.isFinite(vendorId) && vendorId > 0) void run();
    return () => {
      alive = false;
    };
  }, [vendorId]);

  const OPEN = ["OPEN", "IN_REVIEW"];
  const ACCEPTED = ["ACCEPTED_RISK"];
  const RESOLVED = ["accepted"];

  const counts = useMemo(() => {
    const c = (set: string[]) => rows.filter((r) => set.includes(String(r.status))).length;
    return {
      open: c(OPEN),
      accepted: c(ACCEPTED),
      resolved: c(RESOLVED),
    };
  }, [rows]);

  const visibleTabs = useMemo(() => {
    const base: Array<{ key: "open" | "accepted" | "accepted"; label: string; count: number }> = [
      { key: "open" as const, label: "Open", count: counts.open },
      { key: "accepted" as const, label: "Accepted Risk", count: counts.accepted },
    ];
    if (showResolved) base.push({ key: "accepted" as const, label: "accepted", count: counts.resolved });
    return base;
  }, [counts, showResolved]);

  // If user hides resolved while on resolved tab, snap back.
  useEffect(() => {
    if (!showResolved && tab === "accepted") setTab("open");
  }, [showResolved, tab]);

  const activeStatuses =
    tab === "open" ? OPEN : tab === "accepted" ? ACCEPTED : RESOLVED;

  const emptyLabel =
    tab === "open"
      ? "No open findings for this vendor."
      : tab === "accepted"
      ? "No accepted risks for this vendor."
      : "No resolved findings for this vendor.";

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {visibleTabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                  active
                    ? "border-white/20 bg-white/10 text-slate-50"
                    : "border-white/10 bg-white/5 text-slate-200/80 hover:bg-white/10"
                )}
              >
                <span className="font-medium">{t.label}</span>
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs text-slate-100/80">
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowResolved((v) => !v)}
          className={clsx(
            "rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide",
            showResolved
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
              : "border-white/10 bg-white/5 text-slate-200/70 hover:bg-white/10"
          )}
        >
          {showResolved ? "Hide resolved" : "Show resolved"}
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-slate-300">
          Loading vendor findings€¦
        </div>
      ) : err ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-6 text-sm text-rose-100">
          Failed to load vendor findings: {err}
        </div>
      ) : (
        <IssueInboxTable
          issues={rows}
          includeStatuses={activeStatuses}
          emptyLabel={emptyLabel}
          showVendor={false}
        />
      )}
    </div>
  );
}




