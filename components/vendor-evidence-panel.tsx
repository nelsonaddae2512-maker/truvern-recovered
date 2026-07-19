// components/vendor-evidence-panel.tsx
"use client";

import { useMemo, useState } from "react";

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

export default function VendorEvidencePanel({ vendorId }: { vendorId: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");
  const [type, setType] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => !!file && Number.isFinite(vendorId) && vendorId > 0 && !busy,
    [file, vendorId, busy]
  );

  async function onUpload() {
    setError(null);
    setOkMsg(null);

    if (!file) return setError("Choose a file first.");
    if (!Number.isFinite(vendorId) || vendorId <= 0) return setError("Invalid vendorId.");

    setBusy(true);
    try {
      const formData = new FormData();

      const finalFilename = (filename ?? "").trim() || file.name;
      const finalType =
        (type ?? "").trim() || file.type || "application/octet-stream";

      formData.append("file", file);
      formData.append("vendorId", String(vendorId));
      formData.append("filename", finalFilename);
      formData.append("type", finalType);
      formData.append("title", finalFilename);

      const res = await fetch("/api/evidence/upload", {
        method: "POST",
        body: formData,
      });

      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Upload failed (${res.status})`);
      }

      setOkMsg("Uploaded.");
      setFile(null);
      setFilename("");
      setType("");
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-50">Evidence</div>
        <div className="text-xs text-slate-200/60">Vendor #{vendorId}</div>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {okMsg ? (
        <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {okMsg}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Filename (optional)
          </label>
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder={file ? file.name : "SOC2-TypeII.pdf"}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            File
          </label>
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !(type ?? "").trim()) setType(f.type || "");
              if (f && !(filename ?? "").trim()) setFilename(f.name || "");
            }}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            MIME type (optional)
          </label>
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="application/pdf"
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onUpload}
          disabled={!canSubmit}
          className={clsx(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            !canSubmit
              ? "cursor-not-allowed border-white/10 bg-white/5 text-slate-200/60"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
          )}
        >
          {busy ? "Uploading€¦" : "Upload"}
        </button>

        <div className="text-xs text-slate-200/60">{file ? file.name : "No file selected"}</div>
      </div>
    </div>
  );
}


