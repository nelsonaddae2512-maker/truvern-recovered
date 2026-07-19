// components/vendor-evidence-requests-panel.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ReqItem = {
  id: number;
  kind: string;
  label: string;
  description?: string | null;
  dueAt?: string | null;
  status: string;
};

function fmtDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export default function VendorEvidenceRequestsPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<ReqItem[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch("/api/vendor/evidence-requests", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load");
        if (!alive) return;
        setItems(Array.isArray(data.requests) ? data.requests : []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/40">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-50">Evidence requests</div>
          <div className="mt-1 text-xs text-slate-200/60">
            Upload documents requested by your customer.
          </div>
        </div>
        <span className="text-xs text-slate-200/60">{items.length} open</span>
      </div>

      {loading ? (
        <div className="px-5 py-6 text-sm text-slate-200/70">Loading€¦</div>
      ) : err ? (
        <div className="px-5 py-6 text-sm text-rose-200">
          {err}
          <div className="mt-2 text-xs text-slate-200/60">
            If this is unexpected, check Clerk vendorId mapping or enable TRUVERN_DEV_BYPASS_AUTH=1.
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-6 text-sm text-slate-200/70">No evidence requests right now.</div>
      ) : (
        <div className="divide-y divide-white/5">
          {items.map((r) => (
            <div key={r.id} className="px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-medium text-slate-50">{r.label}</div>
                    <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
                      Action required
                    </span>
                    {r.dueAt ? (
                      <span className="text-xs text-slate-200/60">Due {fmtDate(r.dueAt)}</span>
                    ) : null}
                  </div>

                  <div className="mt-1 text-xs text-slate-200/60">Type: {r.kind}</div>

                  {r.description ? (
                    <p className="mt-2 text-sm text-slate-200/70">{r.description}</p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-200/50">No additional instructions.</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/vendor-portal/evidence-requests/${r.id}`}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    Upload evidence †—
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}



