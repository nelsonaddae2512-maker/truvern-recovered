import Link from "next/link";

const steps = [
  {
    title: "Request",
    body: "Customer sends a vendor to Truvern Reviews.",
    icon: "▰",
  },
  {
    title: "Truvern Ops accepts",
    body: "Ops validates the intake and assigns the review path.",
    icon: "♙",
  },
  {
    title: "Vendor questionnaire",
    body: "Truvern sends the questionnaire and tracks completion.",
    icon: "▣",
  },
  {
    title: "Review",
    body: "Experts review answers, evidence, and control posture.",
    icon: "○",
  },
  {
    title: "Findings/remediation",
    body: "Findings, evidence gaps, and remediation requests are generated.",
    icon: "!",
  },
  {
    title: "Release",
    body: "A clean governance-ready report is released back to the customer.",
    icon: "◇",
  },
];

export default function ManagedReviewsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-white">
      <section className="rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-500/10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
          Truvern Reviews
        </p>

        <h1 className="mt-4 max-w-5xl text-4xl font-black tracking-tight sm:text-6xl">
          Send vendors to Truvern.
          <br />
          Get back a clean governance report.
        </h1>

        <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
          Truvern Reviews is the done-for-you vendor review lane:
          Truvern Ops accepts the request, sends the questionnaire, reviews the
          vendor response, generates findings and remediation requests, then
          releases the final governance output.
        </p>

        <div className="mt-8">
          <Link
            href="/vendors"
            className="inline-flex rounded-full bg-cyan-300 px-7 py-4 text-sm font-bold text-slate-950 shadow-xl shadow-cyan-950/40 transition hover:bg-cyan-200"
          >
            Request a Truvern Review
          </Link>
        </div>
      </section>


      <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            What Truvern Reviews
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
            Comprehensive vendor security and governance assessment coverage.
          </h2>

          <p className="mt-5 text-base leading-8 text-slate-300">
            Truvern Reviews evaluate vendors across the operational,
            technical, administrative, and governance controls businesses rely
            on to reduce third-party risk and maintain trust.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            "Access control and identity management",
            "Data protection and encryption",
            "Security monitoring and incident response",
            "Business continuity and disaster recovery",
            "Cloud and infrastructure security",
            "Endpoint and device security",
            "Vendor and subcontractor risk",
            "Security policies and governance",
            "Employee security awareness",
            "Evidence collection and attestations",
            "Compliance and regulatory posture",
            "Remediation tracking and risk findings",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-sm font-medium text-slate-200"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
            Framework alignment
          </p>

          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300">
            Truvern reviews are informed by widely adopted information security
            and governance frameworks including NIST 800-53, SOC 2, ISO 27001,
            CIS Controls, and modern vendor governance best practices.
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20"
          >
            <div className="flex items-start gap-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-sm font-black text-slate-950">
                {index + 1}
              </div>

              <div>
                <h2 className="text-lg font-black text-white">{step.title}</h2>

                <div className="mt-5 flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center text-3xl font-black text-cyan-300">
                    {step.icon}
                  </div>
                  <p className="text-sm leading-7 text-slate-300">{step.body}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}




