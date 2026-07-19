import PublicEvidenceManifest from "@/components/public-evidence-manifest";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Governance Record Demo | Truvern",
  description:
    "Preview a Truvern governance release record with evidence provenance, reviewer outcomes, lifecycle state, and verification posture.",
};

const evidenceItems = [
  "SOC 2 Type II report",
  "Security questionnaire",
  "Incident response policy",
  "Infrastructure architecture review",
];

const findings = [
  "Evidence freshness validated",
  "Security posture reviewed",
  "Operational controls documented",
  "Leadership-ready outcome generated",
];

export default function GovernanceRecordPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-20 text-white">
      <section className="grid gap-10 lg:grid-cols-[1fr_0.95fr]">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Public governance artifact
          </div>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-7xl">
            Verification-ready governance output.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Truvern converts vendor review execution into sealed governance
            records designed for leadership review, audit defensibility, and
            controlled trust sharing.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="rounded-full bg-cyan-300 px-6 py-3 font-medium text-slate-950 transition hover:bg-cyan-200"
            >
              Start pilot
            </Link>

            <Link
              href="/features"
              className="rounded-full border border-white/15 px-6 py-3 font-medium text-white transition hover:bg-white/10"
            >
              Explore platform
            </Link>
          </div>

          <div className="mt-14 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Release manifest
                </p>

                <h2 className="mt-3 text-2xl font-semibold">
                  Vendor review release
                </h2>
              </div>

              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                Verified
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Release ID
                </p>

                <p className="mt-2 font-semibold">
                  GOV-TRV-2026-00428
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Verification checksum
                </p>

                <p className="mt-2 font-semibold">
                  8AF2-19D4-C7E2
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Review outcome
                </p>

                <p className="mt-2 font-semibold">
                  Review complete
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Governance posture
                </p>

                <p className="mt-2 font-semibold">
                  Board-ready
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-950/20">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Evidence reviewed
            </p>

            <div className="mt-6 space-y-3">
              {evidenceItems.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
                >
                  <p className="text-sm text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-amber-300/20 bg-amber-300/10 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-100">
              Governance findings
            </p>

            <div className="mt-5 space-y-3">
              {findings.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3"
                >
                  <div className="mt-1 h-2 w-2 rounded-full bg-amber-200" />

                  <p className="text-sm leading-7 text-slate-100">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Lifecycle
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                  <span>Assess</span>
                  <span>100%</span>
                </div>

                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 w-full rounded-full bg-cyan-300" />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                  <span>Review</span>
                  <span>100%</span>
                </div>

                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 w-full rounded-full bg-cyan-300" />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                  <span>Board</span>
                  <span>92%</span>
                </div>

                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 w-[92%] rounded-full bg-amber-300" />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                  <span>Verify</span>
                  <span>Active</span>
                </div>

                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 w-4/5 rounded-full bg-emerald-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">
              Immutable governance evidence lineage
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              Release-bound evidence registry
            </h2>

            <p className="mt-2 max-w-3xl text-sm text-emerald-100/80">
              This governance record includes immutable attachment manifests,
              reviewer attestations, release snapshot lineage, and checksum-backed
              evidence inventory preservation.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-emerald-100">
            TRV-EVIDENCE-MANIFEST-1.0
          </div>
        </div>
      </div>

      <PublicEvidenceManifest />
      
      <section className="mx-auto mt-16 max-w-7xl rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-500/10">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            Customer Deliverable
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
            This is the governance artifact Truvern customers receive.
          </h2>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            A Truvern governance record packages reviewed evidence, findings,
            remediation status, reviewer conclusions, release timestamps, and
            verification-ready history into a board-defensible vendor review
            artifact.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Reviewed vendor evidence",
            "Governance findings",
            "Remediation status",
            "Reviewer conclusion",
            "Release timestamp",
            "Verification history",
            "Audit-ready trail",
            "Board-defensible output",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm font-semibold text-slate-100"
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}










