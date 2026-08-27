import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing | Truvern",
  description:
    "Buy governance outcomes, not software access. Truvern pricing supports vendor review throughput, managed execution, and board-ready outputs.",
};

const tiers = [
  {
    name: "Free",
    description:
      "For small teams beginning vendor governance operations.",
    items: [
      "Vendor intake workflows",
      "Basic assessment operations",
      "Limited governance workflows",
      "Purchase credits when needed",
    ],
    cta: "Start free",
    href: "/dashboard",
  },
  {
    name: "PRO",
    description:
      "For growing governance programs needing operational scale.",
    items: [
      "Advanced review workflows",
      "Board-ready reporting",
      "Trust Network participation",
      "Priority governance operations",
    ],
    cta: "Upgrade to PRO",
    href: "/billing/plans",
  },
  {
    name: "Enterprise",
    description:
      "For mature governance organizations and managed execution.",
    items: [
      "Truvern Review operations",
      "Dedicated governance capacity",
      "Verification-ready outputs",
      "Enterprise rollout support",
    ],
    cta: "Contact enterprise",
    href: "/contact",
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-20 text-white">
      <section>
        <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
          Governance pricing
        </div>

        <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight md:text-7xl">
          Governance capacity that scales with your vendor risk workload.
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
          Start free, buy Truvern credits when expert help is needed, or move
          into recurring governance capacity as your review program grows.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/truvern-reviews"
            className="rounded-full bg-cyan-300 px-7 py-4 font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Explore Truvern Reviews
          </Link>

          <Link
            href="/contact"
            className="rounded-full border border-white/15 px-7 py-4 font-semibold text-white transition hover:bg-white/10"
          >
            Talk to Truvern
          </Link>
        </div>
      </section>

      <section className="mt-24 grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8"
          >
            <div className="text-sm uppercase tracking-[0.3em] text-cyan-200">
              {tier.name}
            </div>

            <p className="mt-6 text-base leading-8 text-slate-300">
              {tier.description}
            </p>

            <div className="mt-8 space-y-4">
              {tier.items.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href={tier.href}
                className="block w-full rounded-full border border-cyan-400/30 bg-cyan-400/10 px-6 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
              >
                {tier.cta}
              </Link>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-28 rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-8 md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-100">
              Credits and capacity
            </div>

            <h2 className="mt-6 text-4xl font-semibold tracking-tight">
              Buy governance execution, not unused software seats.
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
              Truvern credits fund real review execution, governance packaging,
              and verification-ready outputs. Teams can scale review throughput
              without permanently expanding analyst headcount.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Typical pilot
            </p>

            <div className="mt-5 space-y-4 text-sm text-slate-200">
              <div>5–20 vendors</div>
              <div>30–45 day rollout</div>
              <div>Truvern Review execution</div>
              <div>Board-ready governance outputs</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-500/10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Truvern Reviews
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
              Send vendors to Truvern for 1 credit.
            </h2>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              Truvern Ops distributes the questionnaire, collects evidence,
              reviews responses, generates findings, manages remediation, and
              delivers a clean governance-ready vendor report.
            </p>
          </div>

          <a
            href="/managed-assessments"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            View Truvern Reviews
          </a>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            What 1 Truvern Credit Includes
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
            A complete Truvern governance review.
          </h2>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            Each Truvern Review credit funds the operational lifecycle:
            vendor outreach, questionnaire distribution, evidence intake,
            expert review, findings generation, remediation coordination,
            attestation requests, and final governance release packaging.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Vendor outreach",
            "Questionnaire distribution",
            "Evidence review",
            "Findings generation",
            "Remediation workflow",
            "Attestation requests",
            "Governance release package",
            "Audit-ready review record",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm font-semibold text-cyan-50"
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
