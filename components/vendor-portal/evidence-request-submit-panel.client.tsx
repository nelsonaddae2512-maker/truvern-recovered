"use client";

import { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Item = {
  title: string;
  file?: File | null;
  kind: string;
};

async function uploadOne(file: File): Promise<string> {
  // Uses your existing upload endpoint (commonly present in Truvern):
  // app/api/vendor/upload-file/route.ts
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/vendor/upload-file", {
    method: "POST",
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok || !json?.url) {
    throw new Error(json?.error || "Upload failed");
  }

  return String(json.url);
}

export default function EvidenceRequestSubmitPanel({
  requestId,
  defaultTitle,
  disabled,
}: {
  requestId: number;
  defaultTitle?: string;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([
    { title: defaultTitle || "Evidence Item", file: null, kind: "OTHER" },
  ]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (disabled) return false;
    if (!items.length) return false;
    return items.every((it) => {
      const t = (it.title || "").trim();
      return t.length > 0 && it.file instanceof File;
    });
  }, [items, disabled]);

  function addItem() {
    setOkMsg(null);
    setError(null);
    setItems((prev) => [...prev, { title: defaultTitle || "Evidence Item", file: null, kind: "OTHER" }]);
  }

  function removeItem(idx: number) {
    setOkMsg(null);
    setError(null);
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, patch: Partial<Item>) {
    setOkMsg(null);
    setError(null);
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function onSubmit() {
    setOkMsg(null);
    setError(null);

    if (!canSubmit) {
      setError("Please add a title and choose a file for each item before submitting.");
      return;
    }

    try {
      setBusy(true);

      // 1) upload files -> fileUrl
      const uploaded = [];
      for (const it of items) {
        const file = it.file as File;
        const url = await uploadOne(file);
        uploaded.push({
          title: (it.title || "").trim(),
          fileUrl: url,
          kind: it.kind || "OTHER",
        });
      }

      // 2) submit evidence request items (JSON)
      const res = await fetch(`/api/vendor/evidence-requests/${requestId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: uploaded }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Submit failed");
      }

      setOkMsg("Submitted successfully. Your customer will review the updated evidence.");
      // Reset to single item for convenience
      setItems([{ title: defaultTitle || "Evidence Item", file: null, kind: "OTHER" }]);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass-soft rounded-2xl border border-white/10 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Submit evidence</h2>
          <p className="mt-1 text-sm opacity-80">
            Upload one or more files that satisfy this evidence request.
          </p>
        </div>

        <button
          type="button"
          className={clsx("btn-glass", (busy || disabled) && "opacity-60 pointer-events-none")}
          onClick={addItem}
          disabled={busy || disabled}
        >
          + Add item
        </button>
      </div>

      {disabled ? (
        <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Submissions are disabled because this request is already approved.
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {okMsg ? (
        <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {okMsg}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {items.map((it, idx) => (
          <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-4 md:grid-cols-12 md:items-end">
              <div className="md:col-span-5">
                <label className="text-xs opacity-70">Title</label>
                <input
                  className="input-glass mt-1 w-full"
                  value={it.title}
                  onChange={(e) => updateItem(idx, { title: e.target.value })}
                  placeholder="e.g., SOC 2 Type II Report"
                  disabled={busy || disabled}
                />
              </div>

              <div className="md:col-span-4">
                <label className="text-xs opacity-70">File</label>
                <input
                  className="input-glass mt-1 w-full"
                  type="file"
                  onChange={(e) => updateItem(idx, { file: e.target.files?.[0] || null })}
                  disabled={busy || disabled}
                />
                <div className="mt-1 text-xs opacity-60">
                  {it.file ? it.file.name : "No file selected"}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs opacity-70">Kind</label>
                <select
                  className="input-glass mt-1 w-full"
                  value={it.kind}
                  onChange={(e) => updateItem(idx, { kind: e.target.value })}
                  disabled={busy || disabled}
                >
                  <option value="OTHER">OTHER</option>
                  <option value="SOC2">SOC2</option>
                  <option value="ISO27001">ISO27001</option>
                  <option value="POLICY">POLICY</option>
                  <option value="PROCEDURE">PROCEDURE</option>
                  <option value="AUDIT_REPORT">AUDIT_REPORT</option>
                </select>
                <div className="mt-1 text-[11px] opacity-60">
                  Kind is for UI/labeling.
                </div>
              </div>

              <div className="md:col-span-1 md:text-right">
                <button
                  type="button"
                  className={clsx("btn-glass", (busy || disabled || items.length === 1) && "opacity-60")}
                  onClick={() => removeItem(idx)}
                  disabled={busy || disabled || items.length === 1}
                  title={items.length === 1 ? "Keep at least one item" : "Remove item"}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          className={clsx("btn-primary", (!canSubmit || busy) && "opacity-60 pointer-events-none")}
          onClick={onSubmit}
          disabled={!canSubmit || busy}
          title={!canSubmit ? "Add a title + file for each item" : "Submit evidence"}
        >
          {busy ? "Submitting…" : "Submit"}
        </button>
      </div>
    </section>
  );
}


