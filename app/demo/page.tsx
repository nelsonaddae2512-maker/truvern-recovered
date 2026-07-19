import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Truvern Demo | Vendor Review to Governance Output",
  description:
    "See how Truvern turns vendor evidence, assessments, and review workflows into sealed governance records and board-ready outputs.",
};

export default function DemoPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_40%)]" />

      <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-24">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Interactive governance walkthrough
          </div>

          <h1 className="mt-8 max-w-4xl text-5xl font-semibold tracking-tight text-white md:text-7xl">
            See how Truvern turns vendor reviews into board-ready governance.
          </h1>

          <p className="mt-8 max-w-3xl text-xl leading-9 text-slate-300">
            Walk through the full lifecycle from evidence collection and
            assessment execution to sealed governance outputs and verification-
            ready release records.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/demo/governance-record"
              className="rounded-full bg-cyan-300 px-7 py-4 text-base font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Open governance demo
            </Link>

            <Link
              href="/contact"
              className="rounded-full border border-white/15 px-7 py-4 text-base font-semibold text-white transition hover:bg-white/10"
            >
              Request walkthrough
            </Link>
          </div>
        </div>

        <div className="mt-24 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-cyan-500/20 bg-white/[0.03] p-8 backdrop-blur">
            <div className="text-sm uppercase tracking-[0.3em] text-cyan-200">
              Step 1
            </div>

            <h2 className="mt-6 text-2xl font-semibold text-white">
              Collect evidence
            </h2>

            <p className="mt-4 text-base leading-8 text-slate-300">
              Centralize vendor submissions, provenance, freshness tracking,
              and operational review context.
            </p>
          </div>

          <div className="rounded-3xl border border-violet-500/20 bg-white/[0.03] p-8 backdrop-blur">
            <div className="text-sm uppercase tracking-[0.3em] text-violet-200">
              Step 2
            </div>

            <h2 className="mt-6 text-2xl font-semibold text-white">
              Execute governance reviews
            </h2>

            <p className="mt-4 text-base leading-8 text-slate-300">
              Run internal or Truvern-Truvern Review workflows with decision-
              grade governance outcomes.
            </p>
          </div>

          <div className="rounded-3xl border border-amber-500/20 bg-white/[0.03] p-8 backdrop-blur">
            <div className="text-sm uppercase tracking-[0.3em] text-amber-200">
              Step 3
            </div>

            <h2 className="mt-6 text-2xl font-semibold text-white">
              Publish board-ready outputs
            </h2>

            <p className="mt-4 text-base leading-8 text-slate-300">
              Generate immutable release snapshots, verification artifacts,
              and leadership-ready governance reporting.
            </p>
          </div>
        </div>

        <div className="mt-24 rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 backdrop-blur">
          <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-cyan-100">
            Governance outcomes
          </div>

          <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="text-4xl font-semibold text-white">
                Immutable governance records designed for scrutiny.
              </h2>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Truvern packages review decisions into auditable governance
                outputs with release lineage, evidence provenance, and
                verification posture preserved.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                {[
                  "Release snapshots",
                  "Verification-ready",
                  "Evidence provenance",
                  "Board packet outputs",
                  "Audit-safe history",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-500/20 bg-[#071427] p-8">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Live record
                </div>

                <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
                  Verified
                </div>
              </div>

              <div className="mt-8 text-3xl font-semibold text-white">
                Governance release
              </div>

              <div className="mt-8 space-y-4">
                {[
                  "Immutable release snapshot",
                  "Reviewer decision trail",
                  "Evidence provenance",
                  "Board-ready verification",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    
      <section className="mx-auto mt-16 max-w-7xl rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-500/10">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            What This Demonstrates
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
            Truvern converts vendor reviews into governance-ready release records.
          </h2>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            The demo shows the customer outcome: reviewed evidence, normalized
            findings, remediation context, release history, and verification-ready
            governance artifacts that can support procurement, audit, security,
            legal, and board review.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Evidence-backed review",
            "Reviewer outcome",
            "Findings summary",
            "Risk posture",
            "Release package",
            "Audit trail",
            "Verification record",
            "Board-ready output",
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










