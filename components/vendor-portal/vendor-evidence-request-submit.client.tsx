"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Item = {
  title: string;
  kind: string;
  file: File | null;
};

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function VendorEvidenceRequestSubmitClient(props: {
  vendorId: number;
  evidenceRequestId: number;
  status: string;
  defaultTitle?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<Item[]>([
    { title: props.defaultTitle || "Evidence", kind: "OTHER", file: null },
  ]);

  const [error, setError] = useState<string>("");
  const [okMsg, setOkMsg] = useState<string>("");

  const canSubmit = useMemo(() => {
    return items.some((x) => x.title.trim() && x.file);
  }, [items]);

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setItems((prev) => [...prev, { title: "", kind: "OTHER", file: null }]);
  }

  function removeRow(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function uploadOne(item: Item) {
    const title = item.title.trim();
    if (!title || !item.file) return { ok: false, skipped: true };

    const fd = new FormData();
    fd.append("vendorId", String(props.vendorId));
    fd.append("evidenceRequestId", String(props.evidenceRequestId));
    fd.append("note", title);
    // field name must match your existing endpoint usage
    fd.append("file", item.file);

    const res = await fetch("/api/vendor/evidence-upload", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || `Upload failed (${res.status})` };
    }
    return { ok: true, data };
  }

  async function submit() {
    setError("");
    setOkMsg("");

    const actionable = items.filter((x) => x.title.trim() && x.file);
    if (!actionable.length) {
      setError("Add at least one row with a Title and selected file.");
      return;
    }

    try {
      // upload sequentially so errors are clean + predictable
      for (let i = 0; i < actionable.length; i++) {
        const result = await uploadOne(actionable[i]);
        if (!result.ok) {
          setError(result.error || "Upload failed.");
          return;
        }
      }

      setOkMsg(`Uploaded ${actionable.length} file${actionable.length === 1 ? "" : "s"} successfully.`);

      startTransition(() => {
        router.refresh();
      });
    } catch (e: any) {
      setError(e?.message || "Upload failed.");
    }
  }

  return (
    <section className="glass-soft rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Submit evidence</h2>
          <p className="mt-1 text-sm text-white/70">
            Upload one or more files that satisfy this evidence request.
          </p>
        </div>

        <button type="button" className="btn-glass" onClick={addRow} disabled={isPending}>
          + Add item
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((it, idx) => (
          <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="text-xs text-white/60">Title</label>
                <input
                  className="input-glass mt-1 w-full"
                  value={it.title}
                  onChange={(e) => updateItem(idx, { title: e.target.value })}
                  placeholder="SOC 2 Type II Report"
                />
              </div>

              <div className="md:col-span-1">
                <label className="text-xs text-white/60">File</label>
                <input
                  className="input-glass mt-1 w-full"
                  type="file"
                  onChange={(e) => updateItem(idx, { file: e.target.files?.[0] || null })}
                />
                {it.file ? (
                  <div className="mt-1 text-xs text-white/60 truncate">{it.file.name}</div>
                ) : (
                  <div className="mt-1 text-xs text-white/40">No file selected</div>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="text-xs text-white/60">Kind</label>
                <select
                  className="input-glass mt-1 w-full"
                  value={it.kind}
                  onChange={(e) => updateItem(idx, { kind: e.target.value })}
                >
                  <option value="OTHER">OTHER</option>
                  <option value="SOC2">SOC2</option>
                  <option value="ISO27001">ISO27001</option>
                  <option value="POLICY">POLICY</option>
                  <option value="PENTEST">PENTEST</option>
                </select>
                <div className="mt-1 text-xs text-white/40">
                  (Kind is kept for UI; upload endpoint uses the file + note.)
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className={clsx("btn-glass", items.length <= 1 && "opacity-50 cursor-not-allowed")}
                onClick={() => removeRow(idx)}
                disabled={isPending || items.length <= 1}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}
      {okMsg ? <div className="mt-4 text-sm text-emerald-300">{okMsg}</div> : null}

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          className={clsx("btn-primary", (!canSubmit || isPending) && "opacity-60 cursor-not-allowed")}
          onClick={submit}
          disabled={!canSubmit || isPending}
        >
          {isPending ? "Uploading..." : "Submit"}
        </button>
      </div>
    </section>
  );
}


