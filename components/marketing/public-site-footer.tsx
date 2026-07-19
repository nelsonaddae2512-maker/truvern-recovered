import Link from "next/link";

const productLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/trust-network", label: "Trust Network" },
  { href: "/demo/governance-record", label: "Governance Record Demo" },
];

const resourceLinks = [
  { href: "/contact", label: "Contact" },
  { href: "/demo", label: "Demo" },
  { href: "/board-packet", label: "Board Packet" },
];

const legalLinks = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/dpa", label: "DPA" },
  { href: "/subprocessors", label: "Subprocessors" },
];

export default function PublicSiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#020617]">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            Truvern
          </p>

          <h2 className="mt-4 max-w-lg text-2xl font-black tracking-tight text-white">
            Truvern governance operations.
          </h2>

          <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
            Assessments, evidence review, findings, remediation, attestations,
            and release-ready governance reports for teams that need defensible
            vendor decisions without managing another tool.
          </p>

          <div className="mt-8 text-sm text-slate-500">
            © 2026 Truvern. All rights reserved.
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Product
          </h3>

          <div className="mt-6 flex flex-col gap-4">
            {productLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-slate-300 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Resources
          </h3>

          <div className="mt-6 flex flex-col gap-4">
            {resourceLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-slate-300 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Legal
          </h3>

          <div className="mt-6 flex flex-col gap-4">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-slate-300 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}



