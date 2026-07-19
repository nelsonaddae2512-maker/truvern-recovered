"use client";

import { useState } from "react";

export default function VendorEvidenceUpload({
  requestId,
  vendorId,
}: {
  requestId: number;
  vendorId: number;
}) {
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!file) {
      setMsg("Please choose a file.");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("vendorId", String(vendorId));
      fd.append("evidenceRequestId", String(requestId));
      if (note.trim()) fd.append("note", note.trim());
      fd.append("file", file);

      const res = await fetch("/api/vendor/evidence-upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Upload failed");
      }

      setMsg("Uploaded successfully. Refreshing€¦");
      window.location.reload();
    } catch (err: any) {
      setMsg(err?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass-soft p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">Upload evidence</div>
          <div className="text-sm text-white/70 mt-1">Attach the requested document(s).</div>
        </div>
        <button className="btn-primary" disabled={busy} type="submit">
          {busy ? "Uploading€¦" : "Upload"}
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <input
          className="input-glass"
          placeholder="Optional note to reviewer€¦"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <input
          className="input-glass"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {msg && <div className="text-sm text-white/80">{msg}</div>}
        <div className="text-xs text-white/55">
          Tip: you can upload again later if the reviewer rejects and requests changes.
        </div>
      </div>
    </form>
  );
}



