import Link from "next/link";
import { getReviewEvidence } from "@/lib/evidence/queries";
import { shortChecksum, safeStr } from "@/lib/evidence/checksum";

function formatDate(value: unknown) {
  if (!value) return "Not recorded";

  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return date.toLocaleString();
}

function isApproved(value: unknown) {
  const normalized = safeStr(value).toUpperCase();

  return [
    "APPROVED",
    "ACCEPTED",
    "FULFILLED",
    "COMPLETED",
    "RELEASED",
  ].includes(normalized);
}

function statusTone(status: unknown) {
  const value = safeStr(status).toUpperCase();

  if (isApproved(value)) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }

  if (["REJECTED", "DENIED", "FAILED"].includes(value)) {
    return "border-rose-400/20 bg-rose-400/10 text-rose-100";
  }

  if (["SUBMITTED", "RECEIVED", "PENDING", "REQUESTED"].includes(value)) {
    return "border-amber-400/20 bg-amber-400/10 text-amber-100";
  }

  return "border-white/10 bg-white/5 text-slate-200";
}

export default async function ReviewEvidencePreview({
  reviewAssignmentId,
}: {
  reviewAssignmentId: number;
}) {
  const evidence = await getReviewEvidence(reviewAssignmentId);

  const approved = evidence.filter((item) =>
    isApproved(item.status || item.decision),
  ).length;

  const rejected = evidence.filter((item) =>
    ["REJECTED", "DENIED", "FAILED"].includes(
      safeStr(item.status || item.decision).toUpperCase(),
    ),
  ).length;

  const pending = Math.max(evidence.length - approved - rejected, 0);

  return (
    <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
            Reviewer evidence preview
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            Evidence access workspace
          </h2>

          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Review submitted artifacts, open source files, inspect checksums,
            and validate evidence decision history before governance release.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/api/review-desk/reviews/${reviewAssignmentId}/evidence-manifest`}
            target="_blank"
            className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15"
          >
            Download Manifest
          </Link>

          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
            Immutable Evidence Lineage
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="text-lg font-semibold text-white">
            {evidence.length}
          </div>
          <div className="text-slate-400">Artifacts</div>
        </div>

        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3">
          <div className="text-lg font-semibold text-emerald-100">
            {approved}
          </div>
          <div className="text-emerald-200/70">Approved</div>
        </div>

        <div className="rounded-2xl border border-amber-400/15 bg-amber-400/10 px-4 py-3">
          <div className="text-lg font-semibold text-amber-100">
            {pending}
          </div>
          <div className="text-amber-200/70">Pending</div>
        </div>
      </div>

      {evidence.length ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-12 gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <div className="col-span-4">Evidence</div>
            <div className="col-span-2">Decision</div>
            <div className="col-span-2">Uploaded</div>
            <div className="col-span-2">Checksum</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="divide-y divide-white/10">
            {evidence.map((item) => {
              const href = safeStr(item.fileUrl) || safeStr(item.fileKey);

              const status =
                safeStr(item.status || item.decision) || "RECEIVED";

              return (
                <div
                  key={String(item.id)}
                  className="grid grid-cols-12 gap-3 px-4 py-4 text-sm"
                >
                  <div className="col-span-4">
                    <div className="font-semibold text-white">
                      {safeStr(item.title) || "Evidence artifact"}
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      {safeStr(item.requestTitle) || "General evidence"}
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500">
                      Uploaded by{" "}
                      {safeStr(item.uploadedBy) || "Not recorded"}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(
                        status,
                      )}`}
                    >
                      {status}
                    </span>

                    {isApproved(status) ? (
                      <div className="mt-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                        IMMUTABLE RELEASE SNAPSHOT
                      </div>
                    ) : null}

                    <div className="mt-2 text-[11px] text-slate-500">
                      History: {safeStr(item.decision) || status}
                    </div>
                  </div>

                  <div className="col-span-2 text-slate-300">
                    {formatDate(item.uploadedAt)}

                    <div className="mt-2 text-[11px] text-slate-500">
                      Reviewed {formatDate(item.reviewedAt)}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <code className="break-all rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-cyan-100">
                      {shortChecksum(item.checksum)}
                    </code>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-2">
                    {href ? (
                      <>
                        <Link
                          href={href}
                          target="_blank"
                          className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15"
                        >
                          Open
                        </Link>

                        <Link
                          href={href}
                          target="_blank"
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]"
                        >
                          Download
                        </Link>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">
                        No file link
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
          No evidence artifacts are currently attached to this review.
        </div>
      )}
    </section>
  );
}

