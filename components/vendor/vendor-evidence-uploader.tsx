"use client";

import { useEffect, useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Req = {
  id: number;
  vendorId: number;
  label: string;
  status: string;
  description?: string | null;
  createdAt?: string | null;

  // versions/iterations come from the API and may be on any relation name
  [key: string]: any;
};

type Version = {
  id: number;
  evidenceRequestId?: number;
  fileName?: string | null;
  name?: string | null;
  note?: string | null;
  sha256?: string | null;
  storageKey?: string | null;
  localPath?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: string | null;
  approvedAt?: string | null;
  [key: string]: any;
};

const STATUS = {
  OPEN: "OPEN",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

function normStatus(s: any): string {
  const v = String(s || "").toUpperCase().trim();
  // map any legacy words into the real enum
  if (v === "RECEIVED") return STATUS.SUBMITTED;
  if (v === "REQUESTED" || v === "PENDING") return STATUS.OPEN;
  if (v === "CLOSED") return STATUS.CANCELLED;
  if (v in STATUS) return v;
  return v || STATUS.OPEN;
}

function fmtDate(v?: string | null) {
  if (!v) return "";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

export default function VendorEvidenceUploader({
  vendorId,
  initialRequests,
}: {
  vendorId: number;
  initialRequests: Req[];
}) {
  const [selectedRequestId, setSelectedRequestId] = useState<number | "">("");
  const [file, setFile] = useState<File | null>(null);

  const [items, setItems] = useState<Req[]>(
    Array.isArray(initialRequests) ? initialRequests : []
  );
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // keep local items in sync if parent sends new initialRequests (but prefer live refreshes)
  useEffect(() => {
    setItems(Array.isArray(initialRequests) ? initialRequests : []);
  }, [initialRequests]);

  async function refresh() {
    setLoading(true);
    setLastError(null);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/evidence-requests`, {
        cache: "no-store",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || `Failed to load requests (${res.status})`);
      }
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e: any) {
      console.error(e);
      setLastError(e?.message || "Failed to refresh.");
    } finally {
      setLoading(false);
    }
  }

  // initial live load (gives us versions/iterations)
  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  // Show "actionable" requests by default.
  // - Hide REJECTED + CANCELLED
  // - Keep OPEN/SUBMITTED/APPROVED
  const visibleRequests = useMemo(() => {
    const rows = Array.isArray(items) ? items : [];
    return rows.filter((r) => {
      const s = normStatus(r.status);
      if (!s) return true;
      if (s === STATUS.REJECTED) return false;
      if (s === STATUS.CANCELLED) return false;
      return true;
    });
  }, [items]);

  const totalAll = items?.length ?? 0;
  const totalVisible = visibleRequests.length;

  const selectedReq = useMemo(() => {
    if (!selectedRequestId || typeof selectedRequestId !== "number") return null;
    return (items || []).find((r) => r?.id === selectedRequestId) ?? null;
  }, [items, selectedRequestId]);

  function detectVersions(req: Req | null): Version[] {
    if (!req) return [];

    // Prefer common names first
    const candidates = ["iterations", "versions", "files", "uploads", "evidenceFiles"];
    for (const k of candidates) {
      const v = (req as any)[k];
      if (Array.isArray(v) && v.length) return v as Version[];
    }

    // Otherwise, find any array field that looks like iterations/versions by shape.
    for (const k of Object.keys(req)) {
      const v = (req as any)[k];
      if (!Array.isArray(v) || v.length === 0) continue;
      const first = v[0];
      if (first && typeof first === "object") {
        if (
          typeof first.id === "number" &&
          ("evidenceRequestId" in first ||
            "fileName" in first ||
            "storageKey" in first ||
            "localPath" in first)
        ) {
          return v as Version[];
        }
      }
    }
    return [];
  }

  const versions = useMemo(() => {
    const v = detectVersions(selectedReq);
    // newest first if we can
    return [...v].sort((a, b) => {
      const ta = a.createdAt ? +new Date(a.createdAt) : 0;
      const tb = b.createdAt ? +new Date(b.createdAt) : 0;
      return tb - ta;
    });
  }, [selectedReq]);

  const riskImpactHint = useMemo(() => {
    // simple, safe UI signal:
    // - APPROVED generally reduces "missing evidence" risk
    // - SUBMITTED is neutral (pending review)
    // - OPEN indicates outstanding request -> risk up
    const s = normStatus(selectedReq?.status);
    if (!selectedReq) return null;
    if (s === STATUS.APPROVED) return { tone: "good", text: "Approved — risk impact: improving" };
    if (s === STATUS.SUBMITTED) return { tone: "mid", text: "Submitted — risk impact: pending review" };
    if (s === STATUS.OPEN) return { tone: "warn", text: "Open — risk impact: outstanding evidence" };
    if (s === STATUS.REJECTED) return { tone: "bad", text: "Rejected — risk impact: negative" };
    if (s === STATUS.CANCELLED) return { tone: "mid", text: "Cancelled — risk impact: neutral" };
    return { tone: "mid", text: `Status ${s} — risk impact: unknown` };
  }, [selectedReq]);

  async function handleUpload() {
    if (!selectedRequestId || typeof selectedRequestId !== "number") {
      alert("Please select a request first.");
      return;
    }
    if (!file) {
      alert("Please choose a file first.");
      return;
    }

    setUploading(true);
    setLastError(null);

    // Option B — Flexible:
    // - Allow re-upload
    // - Server keeps status = SUBMITTED
    // - Server treats uploads as new versions (EvidenceRequestIteration)
    const form = new FormData();
    form.append("file", file);
    form.append("vendorId", String(vendorId));
    form.append("evidenceRequestId", String(selectedRequestId));

    const res = await fetch("/api/vendor/evidence-upload", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `Upload failed (${res.status})`);
    }

    // clear + refresh so versions/status update immediately
    setFile(null);
    await refresh();

    // (Optional server hook) If you add an endpoint that recalculates risk,
    // this UI will try it but will not break if missing.
    try {
      await fetch(`/api/vendors/${vendorId}/risk/recompute`, { method: "POST" });
    } catch {
      // ignore if route doesn't exist
    }

    alert("Uploaded successfully (version recorded).");
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-white/70">
            Requests found: <span className="text-white">{totalVisible}</span>{" "}
            <span className="text-white/40">(of {totalAll} total)</span>
            {loading ? <span className="ml-2 text-white/50">• refreshing…</span> : null}
          </div>

          {lastError ? (
            <div className="mt-2 text-sm text-amber-200/90">
              {lastError}{" "}
              <button
                type="button"
                className="ml-2 underline text-white/80 hover:text-white"
                onClick={() => refresh().catch(() => {})}
              >
                Retry
              </button>
            </div>
          ) : null}

          {totalVisible === 0 ? (
            <div className="mt-2 text-sm text-white/60">
              No requests available. Ask the requesting organization to create an evidence request for this vendor.
            </div>
          ) : null}

          {selectedReq && riskImpactHint ? (
            <div
              className={clsx(
                "mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs",
                riskImpactHint.tone === "good" && "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
                riskImpactHint.tone === "warn" && "border-amber-400/30 bg-amber-500/10 text-amber-100",
                riskImpactHint.tone === "bad" && "border-rose-400/30 bg-rose-500/10 text-rose-100",
                riskImpactHint.tone === "mid" && "border-white/10 bg-white/5 text-white/70"
              )}
            >
              {riskImpactHint.text}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/* Request Evidence button (internal side uses the vendor page #evidence section) */}
          <a href={`/vendors/${vendorId}#evidence`} className="btn-glass">
            Request Evidence
          </a>

          <button
            type="button"
            className="btn-glass"
            onClick={() => refresh().catch(() => {})}
            disabled={loading}
            title="Refresh requests"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="block">
          <div className="mb-1 text-xs text-white/60">Select request</div>
          <select
            className={clsx("input-glass w-full")}
            value={selectedRequestId === "" ? "" : String(selectedRequestId)}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedRequestId(v ? Number(v) : "");
            }}
          >
            <option value="">— Choose a request —</option>
            {visibleRequests.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.label} (#{r.id}) • {normStatus(r.status)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-white/60">Choose file</div>
          <input
            className={clsx("input-glass w-full")}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            className={clsx("btn-primary", uploading && "opacity-70 pointer-events-none")}
            onClick={() => {
              handleUpload().catch((e) => {
                console.error(e);
                setLastError(e?.message || "Upload failed.");
                alert(e?.message || "Upload failed.");
              }).finally(() => setUploading(false));
            }}
            disabled={totalVisible === 0 || loading || uploading}
            type="button"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>

          <div className="text-xs text-white/50">
            Vendor #{vendorId} • Re-uploads allowed • Status stays{" "}
            <span className="text-white/70">SUBMITTED</span>
          </div>
        </div>

        {/* Versions list */}
        {selectedRequestId !== "" ? (
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/80">
                Evidence files{" "}
                <span className="text-white/40">
                  (versions for request #{String(selectedRequestId)})
                </span>
              </div>
              <div className="text-xs text-white/50">
                {versions.length ? `${versions.length} file(s)` : "No uploads yet"}
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {versions.length ? (
                versions.slice(0, 20).map((v, idx) => {
                  const name = v.fileName || v.name || `Upload #${idx + 1}`;
                  const when = fmtDate(v.createdAt || v.updatedAt || null);
                  const meta =
                    (v.note ? `Note: ${v.note}` : "") ||
                    (v.sha256 ? `sha: ${v.sha256}` : "") ||
                    (v.storageKey ? `key: ${v.storageKey}` : "") ||
                    (v.localPath ? `path: ${v.localPath}` : "");

                  return (
                    <div
                      key={v.id}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm text-white/85">{name}</div>
                        <div className="shrink-0 text-xs text-white/45">{when}</div>
                      </div>
                      {meta ? (
                        <div className="mt-1 truncate text-xs text-white/50">{meta}</div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-white/60">
                  No uploads yet. Choose a file above and click Upload.
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-white/45">
              Tip: Re-uploading creates a new version and keeps the request in SUBMITTED until reviewed.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


