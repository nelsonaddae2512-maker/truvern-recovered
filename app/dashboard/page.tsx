import Link from "next/link";

const summaryCards = [
  {
    label: "Vendor registry",
    value: "Ready",
    detail: "Profiles, ownership, evidence context",
    href: "/vendors",
    tone: "cyan",
  },
  {
    label: "Governance Ops",
    value: "Operational",
    detail: "Internal and Truvern Review workflow",
    href: "/review-desk",
    tone: "violet",
  },
  {
    label: "Governance outputs",
    value: "Board-ready",
    detail: "Packets, verification records, release posture",
    href: "/demo/governance-record",
    tone: "amber",
  },
];

const workflowSteps = [
  {
    step: "1",
    title: "Add vendors",
    body: "Create vendor profiles and capture ownership, risk context, and evidence requirements.",
    href: "/vendors",
  },
  {
    step: "2",
    title: "Run assessments",
    body: "Collect structured vendor responses and supporting evidence for review.",
    href: "/vendors",
  },
  {
    step: "3",
    title: "Review outcomes",
    body: "Route work through Governance Ops or Truvern Review execution.",
    href: "/review-desk",
  },
  {
    step: "4",
    title: "Publish governance",
    body: "Convert completed review work into board-ready and verification-ready outputs.",
    href: "/demo/governance-record",
  },
];

const signals = [
  "Evidence-backed reviews",
  "Truvern Review capacity",
  "Board-ready outputs",
  "Verification posture",
];

function toneClasses(tone: string) {
  if (tone === "amber") {
    return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  }

  if (tone === "violet") {
    return "border-violet-300/20 bg-violet-300/10 text-violet-100";
  }

  return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
}

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-white">
      <section className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Governance workspace
          </div>

          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight md:text-6xl">
            Your vendor governance command center.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Start from vendor intake, move through evidence and review execution,
            and publish board-ready governance outputs without rebuilding work in
            spreadsheets.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {signals.map((signal) => (
              <span
                key={signal}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-200"
              >
                {signal}
              </span>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/vendors"
              className="rounded-full bg-cyan-300 px-7 py-4 font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Start with vendors
            </Link>

            <Link
              href="/review-desk"
              className="rounded-full border border-white/15 px-7 py-4 font-semibold text-white transition hover:bg-white/10"
            >
              Open Governance Ops
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-950/20">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Program posture
          </p>

          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-xs text-slate-300">Governance readiness</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                Active
              </p>
            </div>

            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
              <p className="text-xs text-slate-300">Board output posture</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                Release-ready
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                Lifecycle
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                Intake → Evidence → Review → Remediate → Board → Verify
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14 grid gap-5 md:grid-cols-3">
        {summaryCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-cyan-950/10 transition hover:border-cyan-300/30 hover:bg-white/[0.07]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">{card.label}</p>
                <p className="mt-4 text-2xl font-semibold text-white">
                  {card.value}
                </p>
              </div>

              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  toneClasses(card.tone),
                ].join(" ")}
              >
                Open
              </span>
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-300">
              {card.detail}
            </p>
          </Link>
        ))}
      </section>

      <section className="mt-16 rounded-[2rem] border border-white/10 bg-white/[0.035] p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Operating path
            </p>

            <h2 className="mt-4 text-3xl font-semibold">
              Move from first vendor to defensible governance output.
            </h2>
          </div>

          <Link
            href="/truvern-reviews"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Explore Truvern Reviews
          </Link>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {workflowSteps.map((item) => (
            <Link
              key={item.step}
              href={item.href}
              className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 transition hover:border-cyan-300/30 hover:bg-white/[0.06]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
                {item.step}
              </div>

              <h3 className="mt-5 text-lg font-semibold text-white">
                {item.title}
              </h3>

              <p className="mt-3 text-sm leading-7 text-slate-300">
                {item.body}
              </p>
            </Link>
          ))}
        </div>
      </section>
    
      <section className="mt-8 rounded-[2rem] border border-cyan-300/20 bg-cyan-400/10 p-6 shadow-2xl shadow-cyan-950/20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
              Customer operations launchpad
            </p>

            <h2 className="mt-3 text-2xl font-semibold text-white">
              Start, route, and release vendor governance work
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              Use this dashboard to add vendors, launch assessments, request Truvern Review support, monitor remediation, and access board-ready governance outputs.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/vendors"
              className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-300/15"
            >
              Add vendor
            </a>

            <a
              href="/assessments/catalog"
              className="rounded-2xl border border-indigo-300/25 bg-indigo-300/10 px-4 py-3 text-sm font-semibold text-indigo-50 hover:bg-indigo-300/15"
            >
              Start assessment
            </a>

            <a
              href="/truvern-reviews"
              className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-50 hover:bg-emerald-300/15"
            >
              Request Truvern Review
            </a>

            <a
              href="/governance"
              className="rounded-2xl border border-violet-300/25 bg-violet-300/10 px-4 py-3 text-sm font-semibold text-violet-50 hover:bg-violet-300/15"
            >
              Governance dashboard
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}







