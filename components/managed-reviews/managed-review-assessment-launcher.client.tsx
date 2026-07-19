"use client";

import { useState, useTransition } from "react";

type Props = {
  vendorId: number;
  vendorName: string;
  assignmentId: number;
  initialAssessmentId?: number | null;
  initialVendorUrl?: string | null;
};

export default function ManagedReviewAssessmentLauncher({
  vendorId,
  vendorName,
  assignmentId,
  initialAssessmentId = null,
  initialVendorUrl = null,
}: Props) {
  const [email, setEmail] = useState("");
  const [assessmentId, setAssessmentId] = useState<number | null>(
    initialAssessmentId,
  );
  const [vendorUrl, setVendorUrl] = useState(initialVendorUrl || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [pending, startTransition] = useTransition();

  function createAssessment() {
    setMessage("");
    setError("");

    startTransition(async () => {
      try {
        const result = await fetch("/api/truvern/framework-assessments", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            frameworkSlug: "nist-800-53-rev5",
            vendorId,
            reviewAssignmentId: assignmentId,
            title: `Truvern Vendor Risk Assessment for ${vendorName}`,
            requestedBy: "truvern-managed-review",
          }),
        });

        const json = await result.json().catch(() => ({}));

        if (!result.ok || !json.ok) {
          throw new Error(json.error || "Failed to create assessment.");
        }

        const id = Number(json.assessment?.id);

        if (!Number.isFinite(id) || id <= 0) {
          throw new Error("Assessment was created but no assessment id was returned.");
        }

        const url = `${window.location.origin}/vendor-assessments/${id}`;

        setAssessmentId(id);
        setVendorUrl(url);
        setMessage("Framework assessment created successfully. Share the vendor workspace link below.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create assessment.");
      }
    });
  }

  function sendAssessment() {
    if (!assessmentId || !email.trim()) return;

    setMessage("");
    setError("");

    startTransition(async () => {
      try {
        const result = await fetch(
          `/api/truvern/framework-assessments/${assessmentId}/send-vendor-link`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              recipients: [email],
            }),
          },
        );

        const json = await result.json().catch(() => ({}));

        if (!result.ok || !json.ok) {
          throw new Error(json.error || "Failed to send assessment.");
        }

        setVendorUrl(json.vendorUrl || vendorUrl);
        setMessage("Vendor review sent successfully.");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to send vendor review.",
        );
      }
    });
  }

  async function copyVendorUrl() {
    if (!vendorUrl) return;

    await navigator.clipboard.writeText(vendorUrl);
    setMessage("Vendor workspace link copied.");
  }

  return (
    <section className="rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-6">
      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
        Truvern Review orchestration
      </div>

      <h3 className="mt-4 text-2xl font-black tracking-tight text-white">
        Create vendor review workspace
      </h3>

      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
        Create the Truvern governance assessment and share the vendor workspace
        link with the vendor contact. Email sending can be connected to this
        workspace after the framework assessment email route is added.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={createAssessment}
          disabled={pending}
          className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
        >
          {pending
            ? "Working..."
            : assessmentId
              ? `Assessment #${assessmentId} created`
              : "Create assessment"}
        </button>
      </div>

      {assessmentId ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
            Vendor contact
          </div>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vendor@example.com"
            className="mt-3 w-full rounded-2xl border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
          />

          <button
            type="button"
            onClick={sendAssessment}
            disabled={pending || !email.trim()}
            className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-300/15 disabled:opacity-50"
          >
            {pending ? "Sending..." : "Send vendor review"}
          </button>
        </div>
      ) : null}

      {vendorUrl ? (
        <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
            Vendor workspace link
          </div>

          <div className="mt-3 break-all rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200">
            {vendorUrl}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={vendorUrl}
              target="_blank"
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/15"
            >
              Open vendor workspace
            </a>

            <button
              type="button"
              onClick={copyVendorUrl}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.09]"
            >
              Copy link
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
    </section>
  );
}






