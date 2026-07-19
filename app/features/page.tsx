import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Features | Truvern",
  description:
    "Explore Truvern capabilities for evidence ops, assessments, review workflows, board outputs, trust sharing, and verification-ready governance.",
};

const capabilities = [
  {
    title: "Evidence Ops",
    body: "Collect vendor evidence with operational context, freshness awareness, and review-ready structure.",
  },
  {
    title: "Assessment Workflows",
    body: "Run vendor reviews from intake through scoring, findings, remediation, and governance packaging.",
  },
  {
    title: "Governance Ops",
    body: "Coordinate internal and Truvern-Truvern Reviews through a governance queue built for throughput.",
  },
  {
    title: "Truvern Reviews",
    body: "Use Truvern credits to reserve expert execution capacity when review demand exceeds team bandwidth.",
  },
  {
    title: "Board Outputs",
    body: "Convert completed reviews into leadership-ready packets, summaries, and defensible governance records.",
  },
  {
    title: "Verification Layer",
    body: "Preserve release state, evidence provenance, and verification posture for audit and trust workflows.",
  },
];

const workflow = [
  "Collect evidence",
  "Run assessment",
  "Review findings",
  "Track remediation",
  "Publish governance output",
  "Verify release record",
];

export default function FeaturesPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-20 text-white">
      <section>
        <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
          Platform capabilities
        </div>

        <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight md:text-7xl">
          Everything connects from vendor evidence to board-defensible output.
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
          Truvern brings evidence operations, assessment execution, review
          workflows, managed capacity, and verification-ready governance records
          into one operating model.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/demo"
            className="rounded-full bg-cyan-300 px-7 py-4 font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            View demo
          </Link>

          <Link
            href="/truvern-reviews"
            className="rounded-full border border-white/15 px-7 py-4 font-semibold text-white transition hover:bg-white/10"
          >
            Explore Truvern Reviews
          </Link>
        </div>
      </section>

      <section className="mt-24 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {capabilities.map((feature) => (
          <div
            key={feature.title}
            className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7"
          >
            <h2 className="text-2xl font-semibold">{feature.title}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {feature.body}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-28 rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-8 md:p-10">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-100">
              Operating model
            </div>

            <h2 className="mt-6 text-4xl font-semibold tracking-tight">
              A complete lifecycle from evidence to verification.
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
              Truvern is designed around the actual governance lifecycle — not
              disconnected forms, spreadsheets, and dashboard fragments.
            </p>
          </div>

          <div className="space-y-3">
            {workflow.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
                  {index + 1}
                </div>

                <p className="text-sm text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    
      <section className="mx-auto mt-16 max-w-7xl rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-500/10">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            Managed Governance Operations
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
            Truvern is not just vendor review software.
          </h2>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            Truvern combines software, expert review operations, evidence
            workflows, remediation management, and immutable governance release
            records so teams can buy completed governance outcomes instead of
            managing disconnected review tools.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            "Truvern-Truvern Reviews",
            "Internal governance ops workflows",
            "Evidence collection and validation",
            "Automated findings and remediation",
            "Attestation and certification requests",
            "Immutable governance release packages",
            "Credit-based expert review operations",
            "Audit-ready review history",
            "Board-defensible vendor governance reports",
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






