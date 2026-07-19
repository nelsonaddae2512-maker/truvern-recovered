import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Trust Network | Truvern",
  description:
    "Share verified vendor trust signals and governance posture through Truvern's controlled Trust Network layer.",
};

const signals = [
  {
    title: "Verified posture",
    body: "Share governance-ready vendor trust signals without exposing private assessment details.",
  },
  {
    title: "Reusable trust evidence",
    body: "Reduce repeated vendor evidence requests by publishing controlled trust-ready summaries.",
  },
  {
    title: "Governance lineage",
    body: "Connect public trust posture to release-backed review records and evidence provenance.",
  },
  {
    title: "Controlled sharing",
    body: "Preserve confidentiality while helping buyers understand vendor governance posture.",
  },
];

const layers = [
  "Private assessment record",
  "Released governance output",
  "Verification-ready trust signal",
  "Controlled public profile",
];

export default function TrustNetworkPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-20 text-white">
      <section className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Trust Network
          </div>

          <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight md:text-7xl">
            Share verified vendor trust signals without exposing private assessments.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Truvern Trust Network is the controlled transparency layer for
            vendor governance posture, trust evidence reuse, and verification-
            ready external sharing.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="rounded-full bg-cyan-300 px-7 py-4 font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Start trust pilot
            </Link>

            <Link
              href="/demo"
              className="rounded-full border border-white/15 px-7 py-4 font-semibold text-white transition hover:bg-white/10"
            >
              View demo
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-950/20">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Sharing model
          </p>

          <div className="mt-6 space-y-3">
            {layers.map((layer, index) => (
              <div
                key={layer}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
                  {index + 1}
                </div>

                <p className="text-sm text-slate-200">{layer}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-100">
              Public signal
            </p>

            <p className="mt-2 text-lg font-semibold text-white">
              Verified · Controlled · Reusable
            </p>
          </div>
        </div>
      </section>

      <section className="mt-24 grid gap-4 md:grid-cols-2">
        {signals.map((signal) => (
          <div
            key={signal.title}
            className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7"
          >
            <h2 className="text-2xl font-semibold">{signal.title}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {signal.body}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-28 rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-8 md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-100">
              Why it matters
            </div>

            <h2 className="mt-6 text-4xl font-semibold tracking-tight">
              Turn governance work into reusable trust momentum.
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
              Buyers repeatedly ask vendors for the same evidence. Truvern helps
              teams convert governed review outputs into controlled trust
              signals that reduce friction while preserving confidentiality.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Trust posture
            </p>

            <div className="mt-5 space-y-4 text-sm text-slate-200">
              <div>Evidence reviewed</div>
              <div>Governance output released</div>
              <div>Verification posture preserved</div>
              <div>External sharing controlled</div>
            </div>
          </div>
        </div>
      </section>
    
      <section className="mx-auto mt-16 max-w-7xl rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-500/10">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            Governance Defensibility
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
            Truvern turns vendor reviews into verifiable governance records.
          </h2>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            Every completed review can become a release-ready governance artifact:
            evidence-backed, findings-driven, remediation-aware, timestamped,
            checksum-sealed, and suitable for audit, board, procurement, and
            executive review workflows.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Immutable release snapshots",
            "Verification-ready manifests",
            "Evidence-backed findings",
            "Audit trail history",
            "Board-ready reports",
            "Reviewer accountability",
            "Remediation outcomes",
            "Third-party governance assurance",
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





