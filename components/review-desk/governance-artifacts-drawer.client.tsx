"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  assignmentId: number;
  checksum?: string | null;
  sealVersion?: string | null;
  sealedAt?: string | null;
  integrityStatus?: string | null;
  receiptId?: string | null;
  ledgerHash?: string | null;
  notarizedAt?: string | null;
};

export default function GovernanceArtifactsDrawer({
  assignmentId,
  checksum,
  sealVersion,
  sealedAt,
  integrityStatus,
  receiptId,
  ledgerHash,
  notarizedAt,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-xs font-semibold text-violet-50 transition hover:bg-violet-500/20"
      >
        Artifacts
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close artifacts drawer"
            onClick={() => setOpen(false)}
          />

          <aside className="relative h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-violet-200">
                  Governance artifacts
                </p>

                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Release package
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-3">
              <Link
                href={`/review-desk/reviews/${assignmentId}/packet`}
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-50"
              >
                View HTML packet
              </Link>

              <Link
                href={`/review-desk/reviews/${assignmentId}/packet/pdf`}
                className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-50"
              >
                Download PDF packet
              </Link>

              <Link
                href={`/api/review-desk/reviews/${assignmentId}/release-manifest`}
                target="_blank"
                className="rounded-2xl border border-violet-400/30 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-50"
              >
                Download release manifest
              </Link>

              <Link
                href={`/api/review-desk/reviews/${assignmentId}/verification-bundle`}
                target="_blank"
                className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/15 px-4 py-3 text-sm font-semibold text-fuchsia-50"
              >
                Download verification bundle
              </Link>

              <Link
                href={`/api/review-desk/reviews/${assignmentId}/verify-bundle`}
                target="_blank"
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-50"
              >
                Verify bundle
              </Link>

              <Link
                href={`/api/review-desk/reviews/${assignmentId}/transparency-log`}
                target="_blank"
                className="rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-50"
              >
                View transparency log
              </Link>

              <Link
                href={`/api/review-desk/reviews/${assignmentId}/verify-seal`}
                target="_blank"
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-50"
              >
                Verify seal
              </Link>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                Integrity status
              </p>

              <p className="mt-2 text-lg font-semibold text-emerald-100">
                {integrityStatus || "UNKNOWN"}
              </p>

              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <p className="text-slate-500">Checksum</p>

                  <p className="mt-1 break-all font-mono text-slate-100">
                    {checksum || "Not recorded"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Seal version</p>

                  <p className="mt-1 text-slate-100">
                    {sealVersion || "Not recorded"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Sealed at</p>

                  <p className="mt-1 text-slate-100">
                    {sealedAt || "Not recorded"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Receipt ID</p>

                  <p className="mt-1 break-all font-mono text-slate-100">
                    {receiptId || "Not recorded"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Ledger hash</p>

                  <p className="mt-1 break-all font-mono text-slate-100">
                    {ledgerHash || "Not recorded"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Notarized at</p>

                  <p className="mt-1 text-slate-100">
                    {notarizedAt || "Not recorded"}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

