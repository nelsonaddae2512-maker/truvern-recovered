"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ActivityItem = {
  id: number;
  organizationId: number;
  vendorId: number | null;
  type: string;
  title: string;
  description: string | null;
  metadata: any;
  createdAt: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  vendor?: { id: number; name: string; slug: string } | null;
};

type ApiResp = {
  scope: "org" | "vendor";
  organizationId: number;
  vendorId: number | null;
  take: number;
  cursor: string | null;
  nextCursor: string | null;
  items: ActivityItem[];
};

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Ãƒ¢Ã¢€š¬Ã¢‚¬";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toneForType(t: string) {
  const s = String(t || "").toUpperCase();
  if (s.includes("EVIDENCE")) return "border-sky-500/30 bg-sky-500/10 text-sky-100";
  if (s.includes("ISSUE")) return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  if (s.includes("BOARD")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (s.includes("VENDOR")) return "border-indigo-500/30 bg-indigo-500/10 text-indigo-100";
  return "border-white/10 bg-white/5 text-slate-100";
}

export default function ActivityFeedPanel(props: {
  scope?: "org" | "vendor";
  vendorId?: number;
  title?: string;
  take?: number;
  className?: string;
  compact?: boolean;
  showVendorLabel?: boolean;
}) {
  const {
    scope = "org",
    vendorId,
    title = scope === "vendor" ? "Recent activity" : "Activity feed",
    take = 25,
    className,
    compact = false,
    showVendorLabel = scope === "org",
  } = props;

  const endpoint = useMemo(() => {
    const base = "/api/activity-feed";
    const params = new URLSearchParams();
    params.set("scope", scope);
    params.set("take", String(take));
    if (scope === "vendor") params.set("vendorId", String(vendorId ?? ""));
    return `${base}?${params.toString()}`;
  }, [scope, vendorId, take]);

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());

  const canFetch = useMemo(() => {
    if (scope !== "vendor") return true;
    return Number.isFinite(Number(vendorId));
  }, [scope, vendorId]);

  async function fetchPage(next?: string | null) {
    if (!canFetch) return;
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const url = new URL(endpoint, window.location.origin);
      if (next) url.searchParams.set("cursor", next);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}${body ? `: ${body}` : ""}`);
      }

      const data = (await res.json()) as ApiResp;

      const merged: ActivityItem[] = [];
      for (const it of data.items || []) {
        if (seenIdsRef.current.has(it.id)) continue;
        seenIdsRef.current.add(it.id);
        merged.push(it);
      }

      setItems((prev) => (next ? [...prev, ...merged] : merged));
      setNextCursor(data.nextCursor ?? null);
    } catch (e: any) {
      setError(e?.message || "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    seenIdsRef.current = new Set();
    setItems([]);
    setNextCursor(null);
    if (canFetch) fetchPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, canFetch]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit && nextCursor && !loading) fetchPage(nextCursor);
      },
      { root: null, rootMargin: "300px 0px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, loading]);

  return (
    <section className={clsx("rounded-2xl border border-white/10 bg-slate-950/40 shadow-sm", className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-slate-50">{title}</div>
          <div className="mt-0.5 text-xs text-slate-200/60">
            {scope === "vendor" ? "Vendor-scoped events" : "Org-wide events"}
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchPage(null)}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
          disabled={loading || !canFetch}
        >
          Refresh
        </button>
      </div>

      <div className={clsx("px-5 py-4", compact ? "max-h-[420px] overflow-auto" : "")}>
        {!canFetch ? (
          <div className="text-sm text-slate-200/70">Missing vendorId.</div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div>
        ) : items.length === 0 && loading ? (
          <div className="text-sm text-slate-200/70">Loading activityÃƒ¢Ã¢€š¬Ã‚¦</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-200/70">No activity yet.</div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className={clsx("rounded-xl border p-3", toneForType(it.type))}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide opacity-90">
                        {it.type.replace(/_/g, " ")}
                      </span>

                      {showVendorLabel && it.vendor ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-100">
                          {it.vendor.name}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-50">{it.title}</div>

                    {it.description ? (
                      <div className="mt-1 text-sm text-slate-200/75">{it.description}</div>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-right text-xs text-slate-200/60">
                    <div>{fmtWhen(it.createdAt)}</div>
                    <div className="mt-0.5">
                      {it.actorName || it.actorEmail || it.actorUserId ? (
                        <span className="opacity-90">{it.actorName || it.actorEmail || "User"}</span>
                      ) : (
                        <span className="opacity-80">System</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div ref={sentinelRef} className="h-6" />

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-slate-200/60">{items.length > 0 ? `${items.length} loaded` : ""}</div>

          {nextCursor ? (
            <button
              type="button"
              onClick={() => fetchPage(nextCursor)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
              disabled={loading}
            >
              {loading ? "LoadingÃƒ¢Ã¢€š¬Ã‚¦" : "Load more"}
            </button>
          ) : (
            <span className="text-xs text-slate-200/50">{items.length > 0 ? "End" : ""}</span>
          )}
        </div>
      </div>
    </section>
  );
}


