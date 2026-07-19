import PublicEvidenceManifest from "@/components/public-evidence-manifest";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Board-ready governance packets. | Truvern",
  description:
    "Truvern turns completed vendor reviews into leadership-ready packets with evidence-backed findings, remediation posture, and verification-ready release records.",
};

const sections = [
  "Executive summary",
  "Risk and remediation posture",
  "Evidence-backed findings",
  "Release and verification state",
];

export default function PublicInfoPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-20 text-white">
      <section className="grid gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-center">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Board Packet
          </div>

          <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight md:text-7xl">
            Board-ready governance packets.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Truvern turns completed vendor reviews into leadership-ready packets with evidence-backed findings, remediation posture, and verification-ready release records.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/contact" className="rounded-full bg-cyan-300 px-7 py-4 font-semibold text-slate-950 transition hover:bg-cyan-200">
              Contact Truvern
            </Link>

            <Link href="/demo" className="rounded-full border border-white/15 px-7 py-4 font-semibold text-white transition hover:bg-white/10">
              View demo
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-950/20">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Page summary
          </p>

          <div className="mt-6 space-y-3">
            {sections.map((item, index) => (
              <div key={item} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
                  {index + 1}
                </div>

                <p className="text-sm text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
            Evidence registry infrastructure
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            Attachment manifests for board-ready packets
          </h2>

          <p className="mt-2 max-w-3xl text-sm text-cyan-100/80">
            Truvern release packets preserve evidence inventory, reviewer
            attestations, immutable checksums, release timestamps, and downloadable
            audit artifacts alongside the board-level governance summary.
          </p>
        </div>

        <PublicEvidenceManifest />
      
      <section className="mt-16 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-8 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
          Immutable release intelligence
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-white">
          Reviewer intelligence snapshot
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
          Released Truvern governance packets now preserve the reviewer intelligence used to support the final governance decision, including findings, remediation posture, attestations, executive summary, recommendation, and breach or federal investigation follow-ups.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            "Findings snapshot",
            "Remediation history",
            "Attestation requests",
            "Reviewer conditions",
            "Executive summary",
            "Final recommendation",
            "Governance timeline",
            "Breach disclosure follow-up",
            "Federal investigation follow-up",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-sm font-semibold text-white">{item}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Captured into the immutable release snapshot for audit, board reporting, and verification-ready archival.
              </p>
            </div>
          ))}
        </div>
      </section></main>
  );
}







