import Link from "next/link";

const tiers = [
  {
    name: "Free Workspace",
    price: "$0",
    caption: "Starter access",
    body:
      "For teams starting internal vendor governance with self-managed reviews.",
    features: [
      "Vendor workspace",
      "Assessment launch",
      "Vendor portal links",
      "Evidence tracking",
      "Manual findings",
      "Self-managed review workspace",
      "No Governance Ops",
      "No release packets, manifests, or immutable archive",
    ],
    cta: "Open Workspace",
    href: "/dashboard",
  },
  {
    name: "Truvern Pro",
    price: "Custom",
    caption: "Annual governance program",
    body:
      "For teams that need Governance Ops, release readiness, and board-ready governance outputs.",
    featured: true,
    features: [
      "Everything in Free",
      "Governance Ops access",
      "Governance intelligence",
      "Release readiness workflow",
      "Board-ready packet access",
      "PDF exports",
      "Attestation package access",
      "Priority onboarding and support",
    ],
    cta: "Request Pro Pricing",
    href: "/contact?interest=PRO&source=plans",
  },
  {
    name: "Enterprise",
    price: "$35K+",
    caption: "Enterprise platform",
    body:
      "For organizations operating a full vendor governance program with advanced controls and support.",
    features: [
      "Everything in Pro",
      "Enterprise access controls",
      "Dedicated onboarding support",
      "Full governance artifact archive",
      "Manifest, seal, and verification records",
      "Executive reporting",
      "Operator enablement",
      "Custom governance workflows",
    ],
    cta: "Contact Truvern",
    href: "/contact?interest=ENTERPRISE&source=plans",
  },
];

export default function BillingPlansPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <section className="mb-10 max-w-4xl">
        <p className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
          Truvern Workspace Plans
        </p>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Governance software for vendor reviews, evidence, and release workflows.
        </h1>

        <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
          Platform plans provide access to the Truvern workspace, assessments,
          evidence workflows, Governance Ops, and reporting infrastructure.
          Truvern Review services are purchased separately with Truvern credits.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/billing/credits"
            className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Buy Truvern Credits
          </Link>

          <Link
            href="/governance-ops"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white hover:bg-white/[0.08]"
          >
            Open Governance Ops
          </Link>
        </div>
      </section>

      <section className="mb-8 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
          Truvern Expert Reviews
        </p>

        <h2 className="mt-3 text-2xl font-semibold text-white">
          Expert governance reviews are purchased separately.
        </h2>

        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
          Truvern credits are used when routing assessments to Truvern Ops for
          expert review, findings validation, remediation workflows, and
          governance release support. Platform plans do not include bundled expert
          review credits unless explicitly negotiated under an enterprise agreement.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/billing/credits"
            className="rounded-2xl border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100"
          >
            Purchase Credits
          </Link>

          <Link
            href="/credits"
            className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15"
          >
            View Credit Activity
          </Link>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {tiers.map((tier) => (
          <article
            key={tier.name}
            className={`rounded-3xl border p-6 ${
              tier.featured
                ? "border-cyan-300/40 bg-cyan-400/10 shadow-2xl shadow-cyan-950/30"
                : "border-white/10 bg-white/[0.04]"
            }`}
          >
            {tier.featured ? (
              <p className="mb-3 inline-flex rounded-full bg-cyan-300 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-950">
                Governance Program
              </p>
            ) : null}

            <h2 className="text-xl font-semibold text-white">{tier.name}</h2>

            <div className="mt-4 flex items-end gap-2">
              <span className="text-3xl font-semibold text-white">
                {tier.price}
              </span>
              <span className="pb-1 text-xs text-slate-400">{tier.caption}</span>
            </div>

            <p className="mt-4 min-h-[72px] text-sm leading-6 text-slate-300">
              {tier.body}
            </p>

            <ul className="mt-5 space-y-2 text-sm text-slate-200">
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span className="text-cyan-200">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href={tier.href}
              className={`mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold ${
                tier.featured
                  ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                  : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              }`}
            >
              {tier.cta}
            </Link>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-xl font-semibold text-white">
          How Truvern pricing works
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Platform plans
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Access Truvern workspace, assessments, Governance Ops, reporting,
              and artifact workflows based on tier.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Truvern credits
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Purchase credits separately when expert governance review,
              remediation support, or Truvern-operated release workflows are
              required.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Enterprise agreements
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Large organizations may negotiate bundled operational support,
              custom governance workflows, and contracted review programs.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
