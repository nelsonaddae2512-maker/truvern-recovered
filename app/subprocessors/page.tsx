import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Trusted infrastructure providers. | Truvern",
  description:
    "Truvern uses infrastructure and service providers to support authentication, hosting, database, email, payments, and operational delivery.",
};

const sections = [
  "Vercel hosting",
  "Clerk authentication",
  "Neon database",
  "Stripe payments",
];

export default function PublicInfoPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-20 text-white">
      <section className="grid gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-center">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Subprocessors
          </div>

          <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight md:text-7xl">
            Trusted infrastructure providers.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Truvern uses infrastructure and service providers to support authentication, hosting, database, email, payments, and operational delivery.
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
    </main>
  );
}


