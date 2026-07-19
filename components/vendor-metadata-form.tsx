// components/vendor-metadata-form.tsx
'use client';

import { useState, useTransition, FormEvent } from 'react';

type Props = {
  vendorId: number;
  initialTier: string | null;
  initialCriticality: string | null;
  initialCategory: string | null;
  initialContactName: string | null;
  initialContactEmail: string | null;
};

export function VendorMetadataForm({
  vendorId,
  initialTier,
  initialCriticality,
  initialCategory,
  initialContactName,
  initialContactEmail,
}: Props) {
  const [tier, setTier] = useState(initialTier ?? '');
  const [criticality, setCriticality] = useState(initialCriticality ?? '');
  const [category, setCategory] = useState(initialCategory ?? '');
  const [contactName, setContactName] = useState(initialContactName ?? '');
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty =
    tier !== (initialTier ?? '') ||
    criticality !== (initialCriticality ?? '') ||
    category !== (initialCategory ?? '') ||
    contactName !== (initialContactName ?? '') ||
    contactEmail !== (initialContactEmail ?? '');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isDirty) {
      setSuccess('No changes to save.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/vendors/${vendorId}/metadata`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tier: tier || null,
            criticality: criticality || null,
            category: category || null,
            primaryContactName: contactName || null,
            primaryContactEmail: contactEmail || null,
          }),
        });

        if (!res.ok) {
          let message = `Save failed (${res.status})`;
          try {
            const data = await res.json();
            if (data?.message || data?.error) {
              message = String(data.message || data.error);
            }
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        setSuccess('Vendor details updated.');
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? 'Failed to save changes.');
      }
    });
  }

  return (
    <section className="border rounded-lg px-4 py-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Vendor metadata</h2>
        <button
          type="submit"
          form="vendor-metadata-form"
          disabled={isPending || !isDirty}
          className="text-xs border rounded-md px-3 py-1 hover:bg-muted transition-colors disabled:opacity-60"
        >
          {isPending ? 'Saving€¦' : isDirty ? 'Save changes' : 'Up to date'}
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        High-level attributes that describe how critical this vendor is to your
        organisation. Changes here are saved directly to the live database.
      </p>

      <form
        id="vendor-metadata-form"
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Tier
          </label>
          <input
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            placeholder="e.g. Tier 1, Tier 2"
            className="border rounded-md px-2 py-1.5 text-sm w-full"
          />
          <p className="text-xs text-muted-foreground">
            Examples: Tier 1 (critical), Tier 2 (important), Tier 3
            (non-critical).
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Criticality
          </label>
          <input
            value={criticality}
            onChange={(e) => setCriticality(e.target.value)}
            placeholder="e.g. High, Medium, Low"
            className="border rounded-md px-2 py-1.5 text-sm w-full"
          />
          <p className="text-xs text-muted-foreground">
            Business impact if this vendor is unavailable or compromised.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Category
          </label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Infrastructure, Payments, Legal"
            className="border rounded-md px-2 py-1.5 text-sm w-full"
          />
          <p className="text-xs text-muted-foreground">
            Example categories: Infrastructure, HR systems, Legal, Payments,
            Marketing.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Primary contact name
          </label>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Contact person at vendor"
            className="border rounded-md px-2 py-1.5 text-sm w-full"
          />
          <p className="text-xs text-muted-foreground">
            Main person responsible at the vendor for security and risk
            matters.
          </p>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Primary contact email
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="name@example.com"
            className="border rounded-md px-2 py-1.5 text-sm w-full"
          />
          <p className="text-xs text-muted-foreground">
            Used for escalation, notifications, and remediation coordination.
          </p>
        </div>
      </form>

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-600" role="status">
          {success}
        </p>
      )}
    </section>
  );
}


