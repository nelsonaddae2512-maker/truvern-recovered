"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type VendorPayload = {
  name: string;
  summary?: string;
  category?: string;
  tier?: string;
  criticality?: string;
  website?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  dataAccess?: string[];
  sensitiveData?: string[];
  externalAccess?: boolean;
  productionAccess?: boolean;
};

export default function NewVendorForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState("STANDARD");
  const [criticality, setCriticality] = useState("MEDIUM");

  const [website, setWebsite] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [primaryContactPhone, setPrimaryContactPhone] = useState("");

  const [dataAccess, setDataAccess] = useState<string[]>([]);
  const [sensitiveData, setSensitiveData] = useState<string[]>([]);
  const [externalAccess, setExternalAccess] = useState(false);
  const [productionAccess, setProductionAccess] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Vendor name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: VendorPayload = {
      name: name.trim(),
      summary: summary.trim() || undefined,
      category: category.trim() || undefined,
      tier,
      criticality,
      website: website.trim() || undefined,
      primaryContactName: primaryContactName.trim() || undefined,
      primaryContactEmail: primaryContactEmail.trim() || undefined,
      primaryContactPhone: primaryContactPhone.trim() || undefined,
      dataAccess,
      sensitiveData,
      externalAccess,
      productionAccess,
    };

    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Create failed with status ${res.status}.`);
      }

      const vendorId = data?.vendor?.id ?? data?.id;

      window.location.assign(vendorId ? `/vendors/${vendorId}` : "/vendors");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
            Vendor profile
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Core vendor information
          </h2>
        </div>

        <div>
          <label className="text-sm font-semibold text-white">
            Vendor name
          </label>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme Cloud"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-white">
            Summary / description
          </label>

          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Describe what the vendor provides and what systems or data they interact with."
            rows={5}
            className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label className="text-sm font-semibold text-white">
              Category
            </label>

            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Cloud, HR, Finance"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-white">
              Tier
            </label>

            <select
              value={tier}
              onChange={(event) => setTier(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
            >
              <option value="STANDARD">Standard</option>
              <option value="IMPORTANT">Important</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-white">
              Criticality
            </label>

            <select
              value={criticality}
              onChange={(event) => setCriticality(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-6 border-t border-white/10 pt-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
            Vendor contacts
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Primary vendor contact
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-white">
              Contact name
            </label>

            <input
              value={primaryContactName}
              onChange={(event) => setPrimaryContactName(event.target.value)}
              placeholder="Jane Smith"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-white">
              Contact email
            </label>

            <input
              type="email"
              value={primaryContactEmail}
              onChange={(event) => setPrimaryContactEmail(event.target.value)}
              placeholder="security@vendor.com"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-white">
              Contact phone
            </label>

            <input
              value={primaryContactPhone}
              onChange={(event) => setPrimaryContactPhone(event.target.value)}
              placeholder="+1 (555) 555-5555"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-white">
              Website / domain
            </label>

            <input
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://vendor.com"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
            />
          </div>
        </div>
      </section>


      <section className="space-y-6 border-t border-white/10 pt-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
            Data access & exposure
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            What business data can this vendor access?
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            Identify the types of systems, customer information, and operational
            environments this vendor may access during service delivery.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
            <p className="text-sm font-semibold text-white">
              Business systems / environments
            </p>

            <div className="mt-4 space-y-3">
              {[
                "Customer portal",
                "Cloud infrastructure",
                "Production systems",
                "Finance systems",
                "Internal applications",
                "Identity provider / SSO",
                "Source code / repositories",
                "Employee systems",
              ].map((item) => (
                <label
                  key={item}
                  className="flex items-center gap-3 text-sm text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={dataAccess.includes(item)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setDataAccess((current) => [...current, item]);
                      } else {
                        setDataAccess((current) =>
                          current.filter((value) => value !== item),
                        );
                      }
                    }}
                    className="h-4 w-4 rounded border-white/20 bg-slate-950"
                  />

                  {item}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
            <p className="text-sm font-semibold text-white">
              Sensitive data exposure
            </p>

            <div className="mt-4 space-y-3">
              {[
                "Customer PII",
                "Employee PII",
                "Financial records",
                "Authentication credentials",
                "Health information",
                "Confidential business data",
                "Security logs",
                "Source code / IP",
              ].map((item) => (
                <label
                  key={item}
                  className="flex items-center gap-3 text-sm text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={sensitiveData.includes(item)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSensitiveData((current) => [...current, item]);
                      } else {
                        setSensitiveData((current) =>
                          current.filter((value) => value !== item),
                        );
                      }
                    }}
                    className="h-4 w-4 rounded border-white/20 bg-slate-950"
                  />

                  {item}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={externalAccess}
              onChange={(event) => setExternalAccess(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-950"
            />

            Vendor has external remote access into company systems
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={productionAccess}
              onChange={(event) => setProductionAccess(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-950"
            />

            Vendor may access production environments
          </label>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={() => router.push("/vendors")}
          disabled={submitting}
          className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
        >
          {submitting ? "Creating vendor..." : "Create vendor"}
        </button>
      </div>
    </form>
  );
}




