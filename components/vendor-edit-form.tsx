// components/vendor-edit-form.tsx
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function safeJson(res: Response) {
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    return { raw: txt };
  }
}

type Props = {
  vendorId: number;
  initial: {
    name: string;
    summary: string | null;
    category: string | null;
    tier: string | null;
    criticality: string | null;
    status: string | null;
  };
};

export default function VendorEditForm({ vendorId, initial }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [name, setName] = useState(initial.name ?? "");
  const [summary, setSummary] = useState(initial.summary ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [tier, setTier] = useState(initial.tier ?? "");
  const [criticality, setCriticality] = useState(initial.criticality ?? "");
  const [status, setStatus] = useState(initial.status ?? "");

  const canSubmit = useMemo(() => name.trim().length > 0 && !pending, [name, pending]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    setPending(true);

    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          summary,
          category,
          tier,
          criticality,
          status,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        setError(String(data?.error ?? "Failed to save vendor."));
        setPending(false);
        return;
      }

      setSaved("Saved.");
      setPending(false);

      // Go back to vendor detail
      router.push(`/vendors/${vendorId}`);
      router.refresh();
    } catch (err: any) {
      setError(String(err?.message ?? err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-slate-950/40 p-6">
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {saved}
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-slate-200">Vendor name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-50"
          placeholder="Acme Corporation"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-200">Summary / Description</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-50"
          placeholder="What does this vendor provide?"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-200">Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-50"
            placeholder="Cloud, Payments, Security€¦"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-200">Status</label>
          <input
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-50"
            placeholder="ACTIVE"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-200">Tier</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-50"
          >
            <option value="">€”</option>
            <option value="CRITICAL">Critical</option>
            <option value="IMPORTANT">Important</option>
            <option value="STANDARD">Standard</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-200">Criticality</label>
          <select
            value={criticality}
            onChange={(e) => setCriticality(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-50"
          >
            <option value="">€”</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(`/vendors/${vendorId}`)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={!canSubmit}
          className={clsx(
            "rounded-lg px-4 py-2 text-sm font-medium",
            canSubmit
              ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              : "bg-slate-700 text-slate-300 cursor-not-allowed"
          )}
        >
          {pending ? "Saving€¦" : "Save changes"}
        </button>
      </div>
    </form>
  );
}


