"use client";

// components/vendors/vendor-evidence-requests-client.tsx
import Link from "next/link";
import { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtDate(d?: Date | string | null) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  try {
    return dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function normStatus(s: any) {
  const v = String(s ?? "").toUpperCase().trim();
  // Prisma enum: OPEN / SUBMITTED / APPROVED / REJECTED / CANCELLED
  if (v === "CANCELED") return "CANCELLED";
  return v || "OPEN";
}

function statusPill(status: string) {
  const s = normStatus(status);
  if (s === "APPROVED") return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
  if (s === "REJECTED") return "bg-rose-500/15 text-rose-200 border-rose-400/30";
  if (s === "SUBMITTED") return "bg-amber-500/15 text-amber-200 border-amber-400/30";
  if (s === "CANCELLED") return "bg-white/10 text-white/60 border-white/10";
  return "bg-sky-500/10 text-sky-200 border-sky-400/25"; // OPEN
}

export default function VendorEvidenceRequestsClient({
  vendorId,
  requests,
}: {
  vendorId: number;
  requests?: any[];
}) {
  // ✅ Make absolutely sure requests is an array
  const rows: any[] = Array.isArray(requests) ? requests : [];

  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const label = String(r?.label ?? "").toLowerCase();
      const kind = String(r?.kind ?? "").toLowerCase();
      const status = String(r?.status ?? "").toLowerCase();
      return label.includes(q) || kind.includes(q) || status.includes(q);
    });
  }, [rows, query]);

  const counts = useMemo(() => {
    const c = { open: 0, submitted: 0, approved: 0, rejected: 0, cancelled: 0 };
    for (const r of rows) {
      const s = normStatus(r?.status);
      if (s === "OPEN") c.open++;
      else if (s === "SUBMITTED") c.submitted++;
      else if (s === "APPROVED") c.approved++;
      else if (s === "REJECTED") c.rejected++;
      else if (s === "CANCELLED") c.cancelled++;
    }
    return c;
  }, [rows]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
            OPEN: <span className="text-white/90 font-semibold">{counts.open}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
            SUBMITTED:{" "}
            <span className="text-white/90 font-semibold">{counts.submitted}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
            APPROVED:{" "}
            <span className="text-white/90 font-semibold">{counts.approved}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
            REJECTED:{" "}
            <span className="text-white/90 font-semibold">{counts.rejected}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requests…"
            className="input-glass w-[240px] max-w-full"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 text-sm text-white/60">
          No evidence requests found for this vendor.
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[minmax(0,1fr)_110px_110px_140px] gap-3 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
            <div>Request</div>
            <div>Status</div>
            <div>Kind</div>
            <div className="text-right">Action</div>
          </div>

          <div className="divide-y divide-white/5">
            {filtered.map((r) => {
              const id = Number(r?.id);
              const status = normStatus(r?.status);
              const canReview = status === "SUBMITTED";
              const label = String(r?.label ?? `Request #${id || "—"}`);
              const kind = String(r?.kind ?? "OTHER");

              return (
                <div
                  key={String(r?.id ?? Math.random())}
                  className="grid grid-cols-[minmax(0,1fr)_110px_110px_140px] gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {label}
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      Due: {fmtDate(r?.dueAt)} • Updated: {fmtDate(r?.updatedAt)}
                    </div>
                  </div>

                  <div className="flex items-center">
                    <span
                      className={clsx(
                        "inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold",
                        statusPill(status)
                      )}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="flex items-center text-xs text-white/70">
                    {kind}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {id ? (
                      <>
                        {canReview ? (
                          <Link
                            className="btn-primary"
                            href={`/org/evidence-requests/${id}`}
                            title="Review submission"
                          >
                            Review ↗
                          </Link>
                        ) : (
                          <Link
                            className="btn-glass"
                            href={`/org/evidence-requests/${id}`}
                            title="Open request"
                          >
                            Open ↗
                          </Link>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-white/40">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/40">
        <span>Showing {filtered.length} of {rows.length}.</span>
        <Link className="btn-glass" href={`/vendors/${vendorId}#evidence`}>
          Refresh ↻
        </Link>
      </div>
    </div>
  );
}


