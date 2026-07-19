import Link from "next/link";

const proofPoints = [
  "Immutable records",
  "Cryptographic verification",
  "Enterprise grade",
];

const outcomes = [
  {
    title: "Vendor evidence intake",
    body: "Collect vendor context, evidence, assessments, and ownership signals in one governance workspace.",
  },
  {
    title: "Expert review operations",
    body: "Route reviews through internal teams or Truvern-managed governance experts with release-ready outputs.",
  },
  {
    title: "Board-ready records",
    body: "Convert completed reviews into packets, manifests, attestations, and verification-ready governance artifacts.",
  },
];


const lifecycleSteps = [
  {
    step: "01",
    title: "Add vendor",
    body: "Submit a vendor directly to Truvern for managed governance review operations.",
  },
  {
    step: "02",
    title: "Vendor engagement",
    body: "Truvern distributes questionnaires, collects evidence, and manages communications.",
  },
  {
    step: "03",
    title: "Expert governance review",
    body: "Truvern reviewers assess responses, generate findings, request attestations, and coordinate remediation.",
  },
  {
    step: "04",
    title: "Governance release",
    body: "Completed reviews are converted into immutable governance records and board-ready release packages.",
  },
];

const deliverables = [
  "Governance release package",
  "Executive-ready findings report",
  "Evidence review trail",
  "Remediation tracking",
  "Vendor attestations",
  "Immutable governance history",
  "Verification-ready records",
  "Board-defensible governance outputs",
];

const buyerTypes = [
  "Security and GRC teams",
  "Procurement organizations",
  "Legal and compliance teams",
  "Companies without SELF-Truvern Review staff",
  "Enterprise vendor governance programs",
  "Organizations needing audit-defensible vendor reviews",
];

const trustItems = [
  "Signed governance manifests",
  "Public verification pages",
  "Immutable release checksums",
  "Enterprise attestations",
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#020617] text-white">
      <section className="relative bg-[radial-gradient(circle_at_28%_12%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#020617_0%,#041827_48%,#020617_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.15),rgba(2,6,23,0.66))]" />

        <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-14 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-12">
          <div>
            <div className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-5 py-2 text-sm font-semibold text-cyan-100 shadow-lg shadow-cyan-950/30">
              Vendor risk operations → board-defensible governance
            </div>

            <h1 className="mt-8 max-w-4xl text-6xl font-semibold leading-[0.98] tracking-[-0.055em] text-white md:text-7xl">
              Buy governance outcomes, not software access.
            </h1>

            <p className="mt-8 max-w-3xl text-xl leading-9 text-slate-300">
              Truvern helps teams collect vendor evidence, execute assessments,
              manage review workflows, and produce verification-ready governance
              outputs for leadership, audits, and board reporting.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-4 rounded-2xl bg-cyan-300 px-8 py-4 text-base font-bold text-slate-950 shadow-2xl shadow-cyan-500/20 transition hover:bg-cyan-200"
              >
                Get started <span className="text-2xl">→</span>
              </Link>

              <Link
                href="/sign-in"
                className="inline-flex items-center gap-4 rounded-2xl border border-white/25 bg-white/[0.03] px-8 py-4 text-base font-bold text-white transition hover:bg-white/10"
              >
                Sign in <span className="text-xl">♙</span>
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-8 text-sm text-slate-300">
              {proofPoints.map((point) => (
                <div key={point} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/40 text-cyan-300">
                    ✦
                  </span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-cyan-400/40 bg-[#081827]/80 p-8 shadow-2xl shadow-cyan-950/40 backdrop-blur">
            <div className="flex items-center justify-between gap-6">
              <p className="text-xs uppercase tracking-[0.38em] text-slate-400">
                Live governance record
              </p>

              <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100">
                Sealed
              </span>
            </div>

            <h2 className="mt-12 text-3xl font-semibold tracking-tight">
              Governance Ops outcome
            </h2>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Completed vendor review converted into board-ready governance
              output.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-6">
                <p className="text-sm text-slate-300">Risk score</p>
                <p className="mt-4 text-3xl font-bold">
                  <span className="text-amber-200">72</span> / Medium
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-6">
                <p className="text-sm text-slate-300">Status</p>
                <p className="mt-4 text-3xl font-bold leading-tight">
                  Review
                  <br />
                  complete
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-4 text-base text-slate-300">
              <p>• Evidence-backed review record</p>
              <p>• Independent reviewer outcome</p>
              <p>• Findings normalized for leadership</p>
              <p>• Board packet and verification-ready output</p>
            </div>

            <Link
              href="/demo/governance-record"
              className="mt-9 inline-flex items-center gap-4 text-base font-bold text-cyan-200 transition hover:text-cyan-100"
            >
              View live record <span className="text-2xl">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#020617]">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
            Governance operations
          </p>

          <h2 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight">
            Move from vendor intake to verified governance output.
          </h2>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {outcomes.map((item) => (
              <article
                key={item.title}
                className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7"
              >
                <h3 className="text-2xl font-semibold">{item.title}</h3>
                <p className="mt-4 leading-7 text-slate-300">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-gradient-to-br from-cyan-500/10 via-[#020617] to-violet-500/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
              Trust infrastructure
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-tight">
              Governance records third parties can verify.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-300">
              Truvern turns completed reviews into immutable records, signed
              manifests, public verification pages, and enterprise attestations.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {trustItems.map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6 text-lg font-semibold text-cyan-50"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    

      <section className="border-t border-white/10 bg-[#020617]">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
            How Truvern works
          </p>

          <h2 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight">
            From vendor request to governance release.
          </h2>

          <div className="mt-10 grid gap-5 lg:grid-cols-4">
            {lifecycleSteps.map((item) => (
              <article key={item.step} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
                <div className="text-sm font-black text-cyan-300">{item.step}</div>
                <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-gradient-to-br from-white/[0.04] via-[#020617] to-cyan-500/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
              What customers receive
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-tight">
              Concrete governance outputs, not another dashboard to manage.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-300">
              Truvern delivers the artifacts leadership, procurement, security,
              compliance, and auditors need to make defensible vendor decisions.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {deliverables.map((item) => (
              <div key={item} className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 text-sm font-semibold text-cyan-50">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#020617]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
              Truvern Ops
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-tight">
              Your managed vendor governance operations team.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-300">
              Truvern Ops handles the operational work teams usually chase
              through spreadsheets, inboxes, vendor portals, consultants, and
              disconnected review documents.
            </p>
          </div>

          <div className="rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8">
            <h3 className="text-2xl font-semibold text-white">
              Built for teams that need outcomes fast.
            </h3>

            <div className="mt-6 grid gap-3">
              {buyerTypes.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="border-y border-cyan-400/20 bg-cyan-500/10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 py-16 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Truvern Reviews
            </div>

            <h2 className="mt-4 text-4xl font-black tracking-tight text-white">
              Send us your vendor. We handle the assessment.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-300">
              Truvern distributes the questionnaire, reviews evidence, generates
              findings, manages remediation, and delivers a governance-ready
              release package for 1 Truvern credit.
            </p>
          </div>

          <a
            href="/managed-assessments"
            className="rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Explore Truvern Reviews
          </a>
        </div>
      </section>
    </main>
  );
}







