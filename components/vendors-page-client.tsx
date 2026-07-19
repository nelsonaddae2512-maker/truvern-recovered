// components/vendors-page-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type VendorRow = { id: number; name: string };

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function safeGet(sp: ReturnType<typeof useSearchParams> | null, key: string) {
  try {
    return sp?.get?.(key) ?? "";
  } catch {
    return "";
  }
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

export default function VendorsPageClient(props: {
  initialVendors?: VendorRow[];
  title?: string;
}) {
  const sp = useSearchParams();

  // œ… SAFE: never calls .get on undefined
  const next = useMemo(() => safeGet(sp, "next") || "/issues", [sp]);
  const needsOrg = useMemo(() => safeGet(sp, "needsOrg") === "1", [sp]);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [vendors, setVendors] = useState<VendorRow[]>(
    Array.isArray(props?.initialVendors) ? props.initialVendors : []
  );

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setQDebounced(q.trim()), 250);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [q]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr(null);

      // If empty query, keep initial vendors (don€™t hammer API)
      if (!qDebounced) {
        const initial = Array.isArray(props?.initialVendors) ? props.initialVendors : [];
        setVendors(initial);
        return;
      }

      setLoading(true);
      try {
        const take = 50;
        const url = `/api/search/vendors?q=${encodeURIComponent(qDebounced)}&take=${take}`;
        const res = await fetch(url, { credentials: "include" });
        const data = await safeJson(res);

        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || `Search failed (${res.status})`);
        }

        const rows = Array.isArray(data?.vendors) ? data.vendors : [];
        const normalized: VendorRow[] = rows
          .map((v: any) => ({
            id: Number(v?.id),
            name: String(v?.name ?? ""),
          }))
          .filter((v: VendorRow) => Number.isFinite(v.id) && v.id > 0 && v.name);

        if (!cancelled) setVendors(normalized);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced]);

  const count = vendors.length;

  return (
    <main className="container-page py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            {props?.title || "Vendors"}
          </h1>
          <p className="mt-1 text-sm text-slate-200/70">
            Search and open a vendor workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={next}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-50 hover:bg-white/10"
          >
            Back
          </Link>

          <Link
            href="/vendors/create"
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15"
          >
            New vendor
          </Link>
        </div>
      </div>

      {needsOrg ? (
        <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          This page needs an organization context. Use the org switcher (top right) and reload.
        </div>
      ) : null}

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Search vendors
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, category, email€¦"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <div className="text-xs text-slate-200/60 min-w-[110px] text-right">
            {loading ? "Searching€¦" : `${count} result${count === 1 ? "" : "s"}`}
          </div>
        </div>

        {err ? (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {err}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        {count === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-10 text-sm text-slate-400">
            No vendors found.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {vendors.map((v) => (
              <Link
                key={v.id}
                href={`/vendors/${v.id}`}
                className="flex items-center justify-between gap-4 py-3 hover:bg-white/5 rounded-xl px-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-50">{v.name}</div>
                  <div className="text-xs text-slate-200/60">Vendor #{v.id}</div>
                </div>

                <div className="text-xs text-slate-200/60">Open †’</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}


