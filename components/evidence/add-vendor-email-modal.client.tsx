"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function AddVendorEmailModal({
  open,
  onClose,
  vendorId,
  vendorName,
  initialName,
  initialEmail,
}: {
  open: boolean;
  onClose: () => void;
  vendorId: number | null;
  vendorName: string;
  initialName?: string | null;
  initialEmail?: string | null;
}) {
  const router = useRouter();
  const [contactName, setContactName] = useState(initialName || "");
  const [contactEmail, setContactEmail] = useState(initialEmail || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setContactName(initialName || "");
    setContactEmail(initialEmail || "");
    setErr(null);
  }, [open, initialName, initialEmail]);

  const emailOk = useMemo(() => !contactEmail || isValidEmail(contactEmail.trim()), [contactEmail]);

  async function save() {
    if (!vendorId) return;
    const email = contactEmail.trim();
    if (email && !isValidEmail(email)) {
      setErr("Please enter a valid email.");
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: contactName.trim(),
          contactEmail: email,
        }),
      });
      const json = await res.json();
      if (!json?.ok) {
        setErr(json?.error || "Save failed");
        return;
      }
      onClose();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-soft rounded-2xl border border-white/10 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Add vendor contact email</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vendor: <span className="text-foreground">{vendorName}</span>
            </p>
          </div>
          <button className="btn-glass" onClick={onClose} disabled={saving}>
            Close
          </button>
        </div>

        {err ? (
          <div className="mt-4 rounded-xl border border-white/10 p-3 text-sm text-amber-200">
            {err}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4">
          <div>
            <label className="block text-sm text-muted-foreground">Contact Name</label>
            <input
              className="input-glass mt-2 w-full"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g., Security Team"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground">Contact Email</label>
            <input
              className="input-glass mt-2 w-full"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="e.g., security@vendor.com"
              inputMode="email"
              type="email"
              autoComplete="email"
            />
            {!emailOk ? (
              <div className="mt-2 text-xs text-amber-200">Please enter a valid email.</div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button className="btn-glass" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving || !emailOk}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

