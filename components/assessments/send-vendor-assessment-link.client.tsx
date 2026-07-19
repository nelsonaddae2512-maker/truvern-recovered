"use client";

import { useMemo, useState } from "react";

type ContactOption = {
  id: string;
  label: string;
  email: string;
};

export default function SendVendorAssessmentLink({
  assessmentId,
  defaultContacts,
}: {
  assessmentId: number;
  defaultContacts: ContactOption[];
}) {
  const [selected, setSelected] = useState<string[]>(
    defaultContacts.length ? [defaultContacts[0].email] : [],
  );
  const [manualEmail, setManualEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recipients = useMemo(() => {
    const manual = manualEmail
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    return Array.from(new Set([...selected, ...manual]));
  }, [manualEmail, selected]);

  function toggle(email: string) {
    setSelected((current) =>
      current.includes(email)
        ? current.filter((item) => item !== email)
        : [...current, email],
    );
  }

  async function send() {
    setSending(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/assessments/${assessmentId}/send-vendor-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to send assessment email.");
      }

      setMessage(`Assessment sent to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to send assessment email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-10 rounded-[2rem] border border-cyan-400/20 bg-white/[0.04] p-7 shadow-2xl shadow-cyan-950/20">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
        Email assessment
      </p>

      <h2 className="mt-3 text-3xl font-semibold text-white">
        Send the secure link to selected contacts.
      </h2>

      <p className="mt-4 max-w-3xl leading-8 text-slate-300">
        Choose vendor contacts or add recipient emails manually. Truvern will send the secure vendor review link.
      </p>

      {defaultContacts.length ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {defaultContacts.map((contact) => (
            <label
              key={contact.id}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition hover:bg-white/[0.06]"
            >
              <input
                type="checkbox"
                checked={selected.includes(contact.email)}
                onChange={() => toggle(contact.email)}
                className="mt-1 h-4 w-4 accent-cyan-300"
              />
              <span>
                <span className="block text-sm font-semibold text-white">
                  {contact.label}
                </span>
                <span className="block text-sm text-cyan-100">
                  {contact.email}
                </span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
          No vendor contacts are saved yet. Add an email manually below.
        </div>
      )}

      <div className="mt-6">
        <label className="text-sm font-semibold text-slate-200">
          Additional recipient emails
        </label>
        <input
          value={manualEmail}
          onChange={(event) => setManualEmail(event.target.value)}
          placeholder="security@vendor.com, compliance@vendor.com"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
        />
      </div>

      {message ? (
        <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={sending || recipients.length === 0}
        onClick={send}
        className="mt-6 rounded-full bg-cyan-300 px-7 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sending ? "Sending..." : "Send assessment"}
      </button>
    </section>
  );
}


