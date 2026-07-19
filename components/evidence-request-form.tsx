// components/evidence-request-form.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  vendorId: number;
  organizationId: number | null;
  onCreatedHref?: string;
};

const KINDS = [
  { value: "SOC2", label: "SOC 2 Report" },
  { value: "ISO27001", label: "ISO 27001 Certificate" },
  { value: "PENTEST", label: "Pen Test Report" },
  { value: "POLICY", label: "Security Policy" },
  { value: "BCP_DRP", label: "BCP / DR Plan" },
  { value: "REPORT", label: "REPORT" },
  { value: "OTHER", label: "Other" },
];

export default function EvidenceRequestForm({
  vendorId,
  organizationId,
  onCreatedHref,
}: Props) {
  const router = useRouter();

  const [kind, setKind] = useState("SOC2");
  const [label, setLabel] = useState("SOC 2 Type II Report");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/evidence-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          organizationId,
          kind,
          label,
          description: description || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed");
      }

      setMsg("Evidence request created.");
      setDescription("");

      if (onCreatedHref) {
        window.location.href = onCreatedHref;
        return;
      }

      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to create request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {msg ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {msg}
        </div>
      ) : null}

      <div className="text-sm font-semibold text-slate-50">Request details</div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <div className="text-xs text-slate-200/60">Type</div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            {KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <div className="text-xs text-slate-200/60">Due date</div>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none"
          />
        </label>
      </div>

      <label className="space-y-1">
        <div className="text-xs text-slate-200/60">Request title</div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none"
        />
      </label>

      <label className="space-y-1">
        <div className="text-xs text-slate-200/60">Instructions for vendor</div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe what the vendor should upload or attest to."
          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
      </label>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || !label.trim()}
        className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create evidence request"}
      </button>
    </div>
  );
}



