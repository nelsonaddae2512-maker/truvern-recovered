import VendorEvidenceRequestSubmitClient from "@/components/vendor-portal/vendor-evidence-request-submit.client";

function statusLabel(value: unknown) {
  const status = String(value ?? "").toUpperCase();

  if (["APPROVED", "COMPLETED", "FULFILLED", "RESOLVED", "CLOSED"].includes(status)) return "Completed";
  if (["SUBMITTED", "IN_REVIEW", "RECEIVED"].includes(status)) return "Waiting for Truvern review";
  if (["REJECTED", "NEEDS_MORE", "NEEDS_REMEDIATION", "CHANGES_REQUESTED"].includes(status)) return "More information needed";

  return "Action required";
}

function statusClass(value: unknown) {
  const label = statusLabel(value);

  if (label === "Completed") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (label === "Waiting for Truvern review") return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  if (label === "More information needed") return "border-rose-300/25 bg-rose-400/10 text-rose-100";

  return "border-amber-300/25 bg-amber-400/10 text-amber-100";
}

type Props = {
  request: any;
  vendorId: number;
};

export default function VendorRemediationCard({ request, vendorId }: Props) {
  const payload =
    request.packagePayload && typeof request.packagePayload === "object"
      ? request.packagePayload
      : {};

  const title =
    payload.vendorTitle ||
    request.packageTitle ||
    request.title ||
    "Remediation package";

  const summary =
    payload.vendorSummary ||
    payload.businessReason ||
    request.notes ||
    "Truvern needs additional information before this review can be completed.";

  const requiredEvidence = Array.isArray(payload.requiredEvidence) ? payload.requiredEvidence : [];
  const requiredAttestations = Array.isArray(payload.requiredAttestations) ? payload.requiredAttestations : [];
  const totalActions = requiredEvidence.length + requiredAttestations.length;

  return (
    <article className="rounded-3xl border border-cyan-300/15 bg-slate-950/80 p-6 shadow-xl shadow-cyan-950/20">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(request.status)}`}>
              {statusLabel(request.status)}
            </span>

            {request.packageSeverity ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                {request.packageSeverity}
              </span>
            ) : null}

            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              {totalActions} item{totalActions === 1 ? "" : "s"} to complete
            </span>
          </div>

          <h3 className="mt-4 text-2xl font-semibold leading-8 text-white">{title}</h3>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-cyan-50/80">{summary}</p>
        </div>

        <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
          <p className="text-xs text-slate-500">Due date</p>
          <p className="mt-1 font-semibold text-white">
            {request.dueAt ? new Date(request.dueAt).toLocaleDateString() : "Not set"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              Evidence checklist
            </p>
            {requiredEvidence.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-cyan-50">
                {requiredEvidence.map((item: any, index: number) => (
                  <li key={`evidence-${request.id}-${index}`} className="flex gap-2">
                    <span className="mt-0.5 text-cyan-200">□</span>
                    <span>{String(item)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-cyan-50/70">No specific evidence checklist was provided.</p>
            )}
          </section>

          <section className="rounded-2xl border border-violet-300/15 bg-violet-300/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-100">
              Attestations needed
            </p>
            {requiredAttestations.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-violet-50">
                {requiredAttestations.map((item: any, index: number) => (
                  <li key={`attestation-${request.id}-${index}`} className="flex gap-2">
                    <span className="mt-0.5 text-violet-200">□</span>
                    <span>{String(item)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-violet-50/70">No attestations are required for this item.</p>
            )}
          </section>

          {payload.releaseImpact ? (
            <section className="rounded-2xl border border-amber-300/15 bg-amber-300/5 p-4 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                Impact on review
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-50">{payload.releaseImpact}</p>
            </section>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-lg font-semibold text-white">Upload evidence</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            Add the files Truvern needs to review this package.
          </p>

          <div className="mt-4 rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-300/5 p-4 text-center">
            <p className="text-sm font-semibold text-cyan-100">Accepted evidence files</p>
            <p className="mt-1 text-xs leading-5 text-cyan-50/70">
              PDF, DOCX, XLSX, CSV, TXT, PNG, JPG, or WEBP evidence files.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              What happens next
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-300">
              <li>Upload the requested evidence.</li>
              <li>Submit any required attestations.</li>
              <li>Truvern reviews your submission.</li>
              <li>We notify you if more information is needed.</li>
              <li>The item is marked complete when approved.</li>
            </ol>
          </div>

          <div className="mt-4">
            <VendorEvidenceRequestSubmitClient
              vendorId={vendorId}
              evidenceRequestId={request.id}
              status={request.status || "REQUESTED"}
              defaultTitle={title}
            />
          </div>
        </aside>
      </div>
    </article>
  );
}

