// components/issues-inbox.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

type VendorOption = { id: number; name: string };
type TabKey = "issues" | "accepted" | "resolved";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function safeJson(res: Response) {
  const txt = await res.text().catch(() => "");
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return { ok: false, error: txt };
  }
}

function buildQuery(params: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const s = v == null ? "" : String(v);
    if (s.trim().length) sp.set(k, s);
  }
  return sp.toString();
}

function parseBool(v: string | null): boolean {
  if (!v) return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function parseTab(v: string | null): TabKey {
  if (v === "issues" || v === "accepted" || v === "resolved") return v;
  return "issues";
}

const SEVERITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export default function IssuesInbox({
  initialTab,
  showResolved,
}: {
  initialTab: TabKey;
  showResolved: boolean;
}) {
  const didHydrateFromUrl = useRef(false);

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [resolvedVisible, setResolvedVisible] = useState(showResolved);

  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [vendorId, setVendorId] = useState<string>("");

  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  const [items, setItems] = useState<IssueRow[]>([]);
  const [counts, setCounts] = useState<{ active: number; accepted: number; resolved: number }>({
    active: 0,
    accepted: 0,
    resolved: 0,
  });

  const [buckets, setBuckets] = useState<{
    active: string[];
    accepted: string[];
    resolved: string[];
  }>({ active: ["OPEN", "IN_REVIEW"], accepted: ["ACCEPTED_RISK"], resolved: ["RESOLVED"] });

  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const qDebouncedRef = useRef<number | null>(null);
  const [qDebounced, setQDebounced] = useState("");

  useEffect(() => {
    // œ… Ensure this only runs in the browser
    if (typeof window === "undefined") return;

    try {
      const sp = new URLSearchParams(window.location.search || "");

      const urlTab = parseTab(sp.get("tab"));
      const urlShowResolved = parseBool(sp.get("showResolved"));

      const urlQ = sp.get("q") ?? "";
      const urlSeverity = sp.get("severity") ?? "";
      const urlVendorId = sp.get("vendorId") ?? "";

      setResolvedVisible(urlShowResolved || showResolved);
      setTab(urlTab === "resolved" && !(urlShowResolved || showResolved) ? "issues" : urlTab);

      setQ(urlQ);
      setQDebounced(urlQ.trim());
      setSeverity(urlSeverity);
      setVendorId(urlVendorId);

      didHydrateFromUrl.current = true;
    } catch {
      // œ… Fallback: treat as hydrated (no URL state)
      didHydrateFromUrl.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!didHydrateFromUrl.current) return;

    if (qDebouncedRef.current) window.clearTimeout(qDebouncedRef.current);
    qDebouncedRef.current = window.setTimeout(() => setQDebounced(q.trim()), 250);
    return () => {
      if (qDebouncedRef.current) window.clearTimeout(qDebouncedRef.current);
    };
  }, [q]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/vendors/list", { credentials: "include" });
        const data = await safeJson(r);
        if (!r.ok || !data?.ok) return;
        setVendorOptions(Array.isArray(data.vendors) ? data.vendors : []);
      } catch {
        // ignore
      }
    })();
  }, []);

  const includeStatuses = useMemo(() => {
    if (tab === "accepted") return buckets.accepted;
    if (tab === "resolved") return buckets.resolved;
    return buckets.active;
  }, [tab, buckets]);

  const emptyLabel =
    tab === "accepted"
      ? "No accepted-risk items."
      : tab === "resolved"
        ? "No resolved issues."
        : "No active issues.";

  function syncUrl(next: {
    tab: TabKey;
    showResolved: boolean;
    q: string;
    severity: string;
    vendorId: string;
  }) {
    const qs = buildQuery({
      tab: next.tab,
      showResolved: next.showResolved ? "1" : null,
      q: next.q || null,
      severity: next.severity || null,
      vendorId: next.vendorId || null,
    });

    const url = qs.length ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", url);
  }

  useEffect(() => {
    if (!didHydrateFromUrl.current) return;
    syncUrl({ tab, showResolved: resolvedVisible, q: qDebounced, severity, vendorId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, resolvedVisible, qDebounced, severity, vendorId]);

  async function loadFirstPage(nextTab: TabKey) {
    setLoading(true);
    setErr(null);
    try {
      const qs = buildQuery({
        tab: nextTab,
        take: "50",
        q: qDebounced || null,
        severity: severity || null,
        vendorId: vendorId || null,
      });

      const r = await fetch(`/api/issues?${qs}`, { credentials: "include" });
      const data = await safeJson(r);
      if (!r.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);

      const fresh = Array.isArray(data.items) ? data.items : [];
      setItems(fresh);

      setCounts({
        active: Number(data?.counts?.active ?? 0),
        accepted: Number(data?.counts?.accepted ?? 0),
        resolved: Number(data?.counts?.resolved ?? 0),
      });

      if (data?.buckets?.active && data?.buckets?.accepted && data?.buckets?.resolved) {
        setBuckets({
          active: data.buckets.active,
          accepted: data.buckets.accepted,
          resolved: data.buckets.resolved,
        });
      }

      const page = data?.page ?? {};
      setNextCursor(typeof page?.nextCursor === "number" ? page.nextCursor : null);
      setHasMore(!!page?.hasMore);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load issues");
      setItems([]);
      setCounts({ active: 0, accepted: 0, resolved: 0 });
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;

    setLoadingMore(true);
    setErr(null);

    try {
      const qs = buildQuery({
        tab,
        take: "50",
        cursor: String(nextCursor),
        q: qDebounced || null,
        severity: severity || null,
        vendorId: vendorId || null,
      });

      const r = await fetch(`/api/issues?${qs}`, { credentials: "include" });
      const data = await safeJson(r);
      if (!r.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);

      const more = Array.isArray(data.items) ? data.items : [];

      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const it of more) if (!seen.has(it.id)) merged.push(it);
        return merged;
      });

      const page = data?.page ?? {};
      setNextCursor(typeof page?.nextCursor === "number" ? page.nextCursor : null);
      setHasMore(!!page?.hasMore);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!didHydrateFromUrl.current) return;
    setItems([]);
    setNextCursor(null);
    setHasMore(false);
    void loadFirstPage(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qDebounced, severity, vendorId]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!didHydrateFromUrl.current) return;

    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        void loadMore();
      },
      { root: null, rootMargin: "800px 0px 800px 0px", threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, nextCursor, loadingMore, tab, qDebounced, severity, vendorId]);

  const visibleTabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "issues", label: "Issues", count: counts.active },
    { key: "accepted", label: "Accepted Risk", count: counts.accepted },
    ...(resolvedVisible
      ? [{ key: "resolved" as const, label: "Resolved", count: counts.resolved }]
      : []),
  ];

  function clearFilters() {
    setQ("");
    setSeverity("");
    setVendorId("");
  }

  async function exportCsv() {
    if (exporting || loading) return;

    try {
      setExporting(true);

      const qs = buildQuery({
        tab,
        q: qDebounced || null,
        severity: severity || null,
        vendorId: vendorId || null,
      });

      const url = `/api/issues/export.csv${qs ? `?${qs}` : ""}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      window.setTimeout(() => setExporting(false), 600);
    }
  }

  const filterBadge = (qDebounced ? 1 : 0) + (severity ? 1 : 0) + (vendorId ? 1 : 0);

  return (
    <main className="container-page py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Issues</h1>
          <p className="mt-1 text-sm text-slate-200/70">
            Active issues exclude Accepted Risk and Resolved findings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/board-report"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-50 hover:bg-white/10"
          >
            View board report
          </Link>

          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || loading}
            className={clsx(
              "rounded-lg border px-3 py-2 text-sm font-medium",
              exporting || loading
                ? "cursor-not-allowed border-white/10 bg-white/5 text-slate-200/60"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
            )}
          >
            {exporting ? "Exporting€¦" : "Export CSV"}
          </button>

          <button
            type="button"
            onClick={() => loadFirstPage(tab)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-50 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs + show resolved */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
          onClick={() => {
            const next = !resolvedVisible;
            setResolvedVisible(next);
            if (!next && tab === "resolved") setTab("issues");
          }}
          className={clsx(
            "rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide",
            resolvedVisible
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
              : "border-white/10 bg-white/5 text-slate-200/70 hover:bg-white/10"
          )}
        >
          {resolvedVisible ? "Hide resolved" : "Show resolved"}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
            <div className="min-w-[240px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Search
              </label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title/description€¦"
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="min-w-[180px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All severities</option>
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[260px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Vendor
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All vendors</option>
                {vendorOptions.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {filterBadge > 0 ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                Filters: {filterBadge}
              </span>
            ) : null}

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        {err ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100/90">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-10 text-sm text-slate-400">
            Loading issues€¦
          </div>
        ) : (
          <>
            <div className="mt-2">
              <IssueInboxTable
                issues={items}
                includeStatuses={includeStatuses}
                emptyLabel={emptyLabel}
                showVendor={true}
              />
            </div>

            <div className="mt-4">
              <div ref={sentinelRef} className="h-10 w-full" aria-hidden="true" />

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  Showing <span className="font-semibold text-slate-200">{items.length}</span> items
                  {hasMore ? " €¢ Loading more as you scroll€¦" : " €¢ End of list"}
                </div>

                {loadingMore ? (
                  <div className="text-xs text-slate-300">Loading€¦</div>
                ) : hasMore ? (
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
                  >
                    Load more
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}


