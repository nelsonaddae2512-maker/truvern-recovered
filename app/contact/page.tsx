import type { Metadata } from "next";

import Link from "next/link";

export const metadata: Metadata = {
  title: "Start a Pilot | Truvern",
  description:
    "Start a Truvern governance pilot for vendor review execution, evidence workflows, board-ready outputs, and verification-ready records.",
};

const pilotItems = [
  {
    title: "Pilot scope",
    value: "5–20 vendors",
  },
  {
    title: "Typical rollout",
    value: "30–45 days",
  },
  {
    title: "Primary output",
    value: "Board-ready governance",
  },
];

const workflowItems = [
  "Vendor evidence collection",
  "Assessment execution",
  "Governance Ops operations",
  "Remediation tracking",
  "Board packet outputs",
  "Verification-ready governance records",
];

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-20 text-white">
      <section className="grid gap-12 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Enterprise pilot intake
          </div>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-7xl">
            Start a governance pilot.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Truvern helps teams operationalize vendor governance without
            rebuilding workflows in spreadsheets. Start with real review
            throughput, governance outputs, and verification-ready reporting.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {pilotItems.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
              >
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  {item.title}
                </p>

                <p className="mt-3 text-lg font-semibold">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Typical rollout
            </p>

            <div className="mt-6 space-y-4">
              {workflowItems.map((item, index) => (
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
        </div>

        <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-8 shadow-2xl shadow-cyan-950/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Pilot intake
              </p>

              <h2 className="mt-4 text-3xl font-semibold">
                Governance readiness discussion
              </h2>
            </div>

            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              Enterprise
            </span>
          </div>

          <div className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Team / organization
              </label>

              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                placeholder="Security, governance, or risk team"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Vendor volume
              </label>

              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                placeholder="Approximate active vendor count"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Current bottleneck
              </label>

              <textarea
                rows={5}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                placeholder="Review backlog, spreadsheet workflows, evidence collection, remediation tracking, board reporting..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Desired timeline
              </label>

              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                placeholder="This quarter, immediate pilot, evaluation phase..."
              />
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-amber-100">
              Pilot expectation
            </p>

            <p className="mt-2 text-sm leading-7 text-slate-200">
              Truvern pilots are structured around real operational execution —
              not demo environments. Teams typically begin with vendor review
              throughput and expand into board-ready governance workflows.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="mailto:contact@truvern.com?subject=Truvern%20pilot%20walkthrough&body=Hi%20Truvern%20team%2C%0A%0AI%27d%20like%20to%20schedule%20a%20pilot%20walkthrough.%0A%0AOrganization%3A%0AVendor%20volume%3A%0ACurrent%20bottleneck%3A%0ADesired%20timeline%3A%0A"
              className="rounded-full bg-cyan-300 px-6 py-3 font-medium text-slate-950 transition hover:bg-cyan-200"
            >
              Schedule walkthrough
            </Link>

            <Link
              href="/pricing"
              className="rounded-full border border-white/15 px-6 py-3 font-medium text-white transition hover:bg-white/10"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>
    
      <section className="mx-auto mt-16 max-w-7xl rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-500/10">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            Work With Truvern
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
            Request Truvern governance operations.
          </h2>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            Contact Truvern to send vendors for Truvern Reviews, set up
            credit-based review operations, discuss enterprise governance
            support, or evaluate Truvern for audit-ready vendor assurance.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Truvern Reviews",
            "Enterprise governance operations",
            "Credit-based expert reviews",
            "Vendor evidence review",
            "Findings and remediation workflows",
            "Board-ready governance reports",
            "Audit defensibility",
            "Truvern Ops support",
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













