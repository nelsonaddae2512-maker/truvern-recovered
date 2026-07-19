// components/vendor-evidence-request-submit.tsx
"use client";

import { useMemo, useState } from "react";

type Item = {
  title: string;
  fileUrl: string;
  kind: string;
};

const KIND_OPTIONS = [
  { value: "REPORT", label: "Report" },
  { value: "POLICY", label: "Policy" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "SCREENSHOT", label: "Screenshot" },
  { value: "OTHER", label: "Other" },
];

function looksLikeHtml(s: string) {
  const t = (s || "").trim().toLowerCase();
  return t.startsWith("<!doctype html") || t.startsWith("<html") || t.includes("<body");
}

export default function VendorEvidenceRequestSubmit({
  requestId,
  canSubmit,
}: {
  requestId: number;
  canSubmit: boolean;
}) {
  const [items, setItems] = useState<Item[]>([
    { title: "", fileUrl: "", kind: "REPORT" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validCount = useMemo(
    () => items.filter((i) => i.title.trim() && i.fileUrl.trim()).length,
    [items]
  );

  function setItem(idx: number, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  }

  function addRow() {
    setItems((prev) => [...prev, { title: "", fileUrl: "", kind: "OTHER" }]);
  }

  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    setError(null);
    if (!canSubmit) return;

    const payloadItems = items
      .filter((i) => i.title.trim() && i.fileUrl.trim())
      .map((i) => ({
        title: i.title.trim(),
        fileUrl: i.fileUrl.trim(),
        kind: i.kind,
      }));

    if (payloadItems.length === 0) {
      setError("Add at least one evidence file (title + URL).");
      return;
    }

    setBusy(true);
    try {
      // œ… Now that /submit supports { items }, we only call this endpoint.
      const res = await fetch(`/api/vendor/evidence-requests/${requestId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (looksLikeHtml(text)) {
          throw new Error(
            `Submit failed (${res.status}). The API route may be missing or returning an HTML error page.`
          );
        }
        throw new Error(text || `Submit failed (${res.status})`);
      }

      // best-effort parse json (your route returns { ok, iterationId, evidenceIds })
      await res.json().catch(() => null);

      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-50">Submit evidence</div>
          <div className="text-xs text-slate-200/70">
            Attach one or more files to fulfill this evidence request.
          </div>
        </div>

        <button
          onClick={addRow}
          className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-50 hover:bg-white/15"
          type="button"
        >
          + Add file
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((it, idx) => (
          <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4">
              <div className="md:col-span-4">
                <label className="text-xs font-semibold text-slate-200/70">Title</label>
                <input
                  value={it.title}
                  onChange={(e) => setItem(idx, { title: e.target.value })}
                  placeholder="e.g., SOC 2 Type II Report (2025)"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-50 outline-none placeholder:text-slate-200/40"
                />
              </div>

              <div className="md:col-span-6">
                <label className="text-xs font-semibold text-slate-200/70">File URL</label>
                <input
                  value={it.fileUrl}
                  onChange={(e) => setItem(idx, { fileUrl: e.target.value })}
                  placeholder="https://€¦"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-50 outline-none placeholder:text-slate-200/40"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-200/70">Kind</label>
                <select
                  value={it.kind}
                  onChange={(e) => setItem(idx, { kind: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-50 outline-none"
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {items.length > 1 ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-50 hover:bg-white/10"
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 whitespace-pre-wrap">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-200/60">{validCount} file(s) ready</div>
        <button
          onClick={submit}
          disabled={!canSubmit || busy}
          className={[
            "rounded-full px-4 py-2 text-sm font-semibold",
            canSubmit && !busy
              ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              : "bg-white/10 text-slate-200/60 cursor-not-allowed",
          ].join(" ")}
        >
          {busy ? "Submitting€¦" : "Submit"}
        </button>
      </div>
    </div>
  );
}



