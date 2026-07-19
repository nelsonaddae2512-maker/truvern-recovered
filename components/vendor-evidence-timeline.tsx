"use client";

import { useEffect, useState } from "react";

type EvidenceItem = {
  id: number;
  title: string;
  description?: string | null;
  kind?: string | null;
  uploadedAt?: string | null;
};

type Props = {
  vendorId: number;
  vendorName: string;
  refreshKey?: number;
};

const FILTERS = [
  { value: "ALL", label: "All types" },
  { value: "REPORT", label: "Report" },
  { value: "POLICY", label: "Policy" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "SCREENSHOT", label: "Screenshot" },
  { value: "OTHER", label: "Other" },
];

export default function VendorEvidenceTimeline({
  vendorId,
  vendorName,
  refreshKey = 0,
}: Props) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [textSearch, setTextSearch] = useState<string>("");

  async function loadEvidence() {
    try {
      setLoading(true);
      setError(null);
      setDeleteError(null);

      const res = await fetch(
        `/api/evidence?vendorId=${vendorId}&take=50`,
        { cache: "no-store" }
      );

      const raw = await res.text();
      let data: any = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          // ignore non-JSON
        }
      }

      if (!res.ok) {
        const msg =
          (data && (data.error as string)) ||
          raw.trim() ||
          "Failed to load evidence.";
        throw new Error(msg);
      }

      const list: EvidenceItem[] = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.evidence)
        ? data.evidence
        : [];

      setItems(list);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load evidence.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!vendorId) {
      setItems([]);
      setError(null);
      setDeleteError(null);
      return;
    }
    loadEvidence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, refreshKey]);

  async function handleDeleteEvidence(evidenceId: number) {
    if (!evidenceId) return;

    const confirmed = window.confirm(
      "Delete this evidence item? This cannot be undone."
    );
    if (!confirmed) return;

    setDeletingId(evidenceId);
    setDeleteError(null);

    try {
      const res = await fetch("/api/evidence/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: evidenceId }),
      });

      const raw = await res.text();
      let data: any = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          // ignore parse errors
        }
      }

      if (!res.ok) {
        const msg =
          (data && (data.error as string)) ||
          raw.trim() ||
          "Failed to delete evidence.";
        throw new Error(msg);
      }

      // Reload list to reflect deletion
      await loadEvidence();
    } catch (err: any) {
      setDeleteError(err?.message ?? "Failed to delete evidence.");
    } finally {
      setDeletingId(null);
    }
  }

  // Kind filter
  const kindFilteredItems =
    activeFilter === "ALL"
      ? items
      : items.filter(
          (ev) =>
            (ev.kind || "OTHER").toUpperCase() === activeFilter.toUpperCase()
        );

  // Text search filter (title + description)
  const search = textSearch.trim().toLowerCase();
  const finalItems =
    search.length === 0
      ? kindFilteredItems
      : kindFilteredItems.filter((ev) => {
          const haystack = `${ev.title || ""} ${ev.description || ""}`.toLowerCase();
          return haystack.includes(search);
        });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h4 className="text-sm font-medium">Evidence timeline</h4>
          <p className="text-[11px] text-slate-400">
            Evidence linked to{" "}
            <span className="font-semibold">{vendorName}</span>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            className="hidden sm:block rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] outline-none focus:border-emerald-400"
            placeholder="Search evidence€¦"
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
          />
          {deleteError && (
            <p className="text-[11px] text-red-400 text-right max-w-xs">
              {deleteError}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setActiveFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-[11px] ${
                isActive
                  ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                  : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-emerald-400"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading evidence€¦</p>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : finalItems.length === 0 ? (
        <p className="text-xs text-slate-400">
          No evidence matches your filters for this vendor.
        </p>
      ) : (
        <ul className="space-y-2 text-xs">
          {finalItems.map((ev) => {
            const uploaded = ev.uploadedAt ? new Date(ev.uploadedAt) : null;
            const chipLabel = (ev.kind || "OTHER").toUpperCase();

            return (
              <li
                key={ev.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium">{ev.title}</span>
                      <span className="text-[10px] rounded-full border border-slate-700 px-2 py-[1px] uppercase tracking-wide">
                        {chipLabel}
                      </span>
                    </div>
                    {ev.description && (
                      <div className="text-slate-400">{ev.description}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-[10px] text-slate-400">
                      {uploaded ? uploaded.toLocaleDateString() : ""}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteEvidence(ev.id)}
                      disabled={deletingId === ev.id}
                      className="text-[10px] rounded-full border border-red-500 px-2 py-[2px] text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                    >
                      {deletingId === ev.id ? "Deleting€¦" : "Delete"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


