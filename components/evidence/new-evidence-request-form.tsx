"use client";

// components/evidence/new-evidence-request-form.tsx
import { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type VendorOpt = { id: number; name: string };

const KIND_OPTIONS = [
  "SOC2",
  "ISO27001",
  "PENTEST",
  "POLICY",
  "QUESTIONNAIRE",
  "SECURITY_OVERVIEW",
  "OTHER",
];

export default function NewEvidenceRequestForm({
  vendors,
  preselectVendorId,
}: {
  vendors: VendorOpt[];
  preselectVendorId?: number;
}) {
  const defaultVendorId = useMemo(() => {
    if (preselectVendorId && vendors.some((v) => v.id === preselectVendorId)) return preselectVendorId;
    return vendors[0]?.id;
  }, [preselectVendorId, vendors]);

  const [vendorId, setVendorId] = useState<number | undefined>(defaultVendorId);
  const [kind, setKind] = useState<string>("SOC2");
  const [title, setTitle] = useState<string>("SOC 2 Type II Report");
  const [dueAt, setDueAt] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<{ id: number; vendorId: number } | null>(null);

  async function submit() {
    setErr(null);
    setOk(null);

    if (!vendorId) {
      setErr("Select a vendor.");
      return;
    }
    if (!title.trim()) {
      setErr("Enter a request title.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/evidence-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendorId,
          kind,
          title: title.trim(),
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setErr(data?.error || `Request failed (${res.status})`);
        return;
      }
      setOk({ id: data.id, vendorId: data.vendorId });
    } catch (e: any) {
      setErr(e?.message || "Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="grid gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-white/60">Vendor</label>
          <select
            className="input-glass mt-1 w-full"
            value={vendorId ?? ""}
            onChange={(e) => setVendorId(Number(e.target.value))}
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {vendors.length === 0 ? (
            <p className="mt-2 text-sm text-white/70">No vendors yet €” create one first.</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs uppercase tracking-wide text-white/60">Kind</label>
            <select className="input-glass mt-1 w-full" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-white/60">Due date</label>
            <input className="input-glass mt-1 w-full" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-white/60">Title</label>
          <input
            className="input-glass mt-1 w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., SOC 2 Type II Report"
          />
          <p className="mt-2 text-xs text-white/50">
            Minimal Phase E-1: we create the request record. Uploads + review workflow comes next.
          </p>
        </div>

        {err ? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{err}</div>
        ) : null}

        {ok ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            Created request #{ok.id}.{" "}
            <a className="underline" href={`/vendors/${ok.vendorId}`}>
              Open vendor
            </a>{" "}
            or{" "}
            <a className="underline" href="/evidence">
              back to Evidence
            </a>
            .
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={clsx("btn-primary", saving && "opacity-70 pointer-events-none")}
            onClick={submit}
            disabled={saving || vendors.length === 0}
          >
            {saving ? "Creating..." : "Create Request"}
          </button>

          <a className="btn-glass" href="/evidence">
            Cancel
          </a>
        </div>
      </div>
    </div>
  );
}



