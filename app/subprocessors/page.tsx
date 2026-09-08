import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subprocessors | Truvern",
  description:
    "Infrastructure and service providers used to deliver Truvern authentication, hosting, database, evidence storage, communications, and payment services.",
};

const providers = [
  {
    provider: "Vercel",
    purpose: "Application hosting and serverless delivery",
    data: "Application requests, operational metadata, and service traffic as required to host Truvern.",
  },
  {
    provider: "Clerk",
    purpose: "Authentication and identity services",
    data: "User identity, account, authentication, and session-related information.",
  },
  {
    provider: "Neon",
    purpose: "PostgreSQL database infrastructure",
    data: "Customer, vendor, assessment, workflow, governance, and application records stored in Truvern's production database.",
  },
  {
    provider: "Amazon Web Services (Amazon S3)",
    purpose: "Private evidence object storage",
    data: "Evidence files and related storage objects submitted through supported evidence workflows.",
  },
  {
    provider: "Resend",
    purpose: "Email delivery and inbound communications processing",
    data: "Email addresses, message content, delivery metadata, and inbound or outbound communication data required for Truvern communications.",
  },
  {
    provider: "Stripe",
    purpose: "Payments, checkout, and billing operations",
    data: "Customer and transaction information required to process purchases and related billing operations.",
  },
];

export default function SubprocessorsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16 text-white">
      <section className="grid gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-start">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Subprocessors
          </div>

          <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight md:text-7xl">
            Infrastructure and service providers.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Truvern uses specialized providers to operate authentication,
            application hosting, databases, private evidence storage,
            communications, and payments.
          </p>

          <p className="mt-5 text-sm text-slate-500">
            Last updated September 8, 2026
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="rounded-full bg-cyan-300 px-7 py-4 font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Contact Truvern
            </Link>

            <Link
              href="/dpa"
              className="rounded-full border border-white/15 px-7 py-4 font-semibold text-white transition hover:bg-white/10"
            >
              View DPA
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-950/20">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Provider coverage
          </p>

          <div className="mt-6 space-y-3">
            {[
              "Application hosting",
              "Authentication",
              "Production database",
              "Private evidence storage",
              "Email communications",
              "Payments and billing",
            ].map((item, index) => (
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

      <section className="mt-16">
        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.035]">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="border-b border-white/10 bg-white/[0.025]">
              <tr>
                <th className="px-6 py-5 text-sm font-semibold text-white">
                  Provider
                </th>
                <th className="px-6 py-5 text-sm font-semibold text-white">
                  Service
                </th>
                <th className="px-6 py-5 text-sm font-semibold text-white">
                  Information involved
                </th>
              </tr>
            </thead>

            <tbody>
              {providers.map((provider) => (
                <tr
                  key={provider.provider}
                  className="border-b border-white/10 last:border-b-0"
                >
                  <td className="px-6 py-6 align-top font-semibold text-cyan-100">
                    {provider.provider}
                  </td>
                  <td className="px-6 py-6 align-top text-sm leading-7 text-slate-300">
                    {provider.purpose}
                  </td>
                  <td className="px-6 py-6 align-top text-sm leading-7 text-slate-400">
                    {provider.data}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:p-8">
          <h2 className="text-xl font-semibold">
            How Truvern manages providers
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
            Truvern uses service providers for defined operational purposes and
            seeks to limit access to information reasonably necessary for those
            services. Provider use may also be subject to the Data Processing
            Addendum and applicable customer agreements.
          </p>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:p-8">
          <h2 className="text-xl font-semibold">
            Changes to this list
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
            Truvern may add, replace, or remove providers as its service
            architecture evolves. This page will be updated to reflect material
            changes to the provider set used for Truvern production services.
          </p>
        </article>
      </section>

      <section className="mt-8 rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.06] p-6 text-sm leading-7 text-slate-300">
        <p>
          Questions about Truvern's provider architecture or data processing
          practices may be submitted through the{" "}
          <Link href="/contact" className="font-semibold text-cyan-200 hover:text-cyan-100">
            contact page
          </Link>
          .
        </p>
      </section>
    </main>
  );
}