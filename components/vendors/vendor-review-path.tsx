import Link from "next/link";

type Props = {
  vendorId: number;
};

export default function VendorReviewPath({
  vendorId,
}: Props) {
  return (
    <section
      id="review-path"
      className="mt-6 rounded-3xl border border-cyan-400/20 bg-cyan-500/[0.08] p-6 shadow-2xl shadow-cyan-950/20"
    >
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
          Review path
        </p>

        <h2 className="mt-3 text-3xl font-black text-white">
          Choose how this vendor will be assessed.
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          Choose Self-Managed Review when your team will own the work, Professional
          Review when you want to launch the assessment first and route that same
          review to Truvern later, or Truvern Review when Truvern should operate
          the workflow end to end.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <article className="flex min-h-[390px] flex-col rounded-3xl border border-cyan-300/25 bg-cyan-400/[0.08] p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
              Truvern Review
            </p>

            <h3 className="mt-3 text-2xl font-black text-white">
              Truvern handles the review
            </h3>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Truvern manages vendor outreach, questionnaire delivery, evidence
              review, findings, remediation coordination, and the final
              governance release package for 1 Truvern credit.
            </p>

            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-200 marker:text-cyan-300">
              <li>Vendor outreach handled by Truvern</li>
              <li>Evidence and remediation tracking</li>
              <li>Governance-ready release packets</li>
              <li>Faster operational execution</li>
            </ul>
          </div>

          <Link
            href={`/vendors/${vendorId}/managed-review`}
            className="mt-auto inline-flex w-fit rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
          >
            Select Truvern Review
          </Link>
        </article>

        <article className="flex min-h-[390px] flex-col rounded-3xl border border-violet-300/20 bg-violet-400/[0.06] p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-200">
              Professional Review
            </p>

            <h3 className="mt-3 text-2xl font-black text-white">
              Start the assessment. Bring Truvern in when needed.
            </h3>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Your team launches the vendor questionnaire and keeps the existing
              assessment workflow. Before professional review begins, route that
              same review to Truvern Ops for expert completion.
            </p>

            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-200 marker:text-violet-300">
              <li>Uses the same vendor assessment and review record</li>
              <li>1 Truvern credit reserved when routed to Truvern</li>
              <li>Reservation can be reversed before Truvern work starts</li>
              <li>No duplicate questionnaire or second assessment</li>
            </ul>
          </div>

          <a
            href="#start-assessment"
            className="mt-auto inline-flex w-fit rounded-full border border-violet-300/30 bg-violet-400/10 px-5 py-3 text-sm font-bold text-violet-50 transition hover:bg-violet-400/20"
          >
            Start Professional Review
          </a>
        </article>
        <article className="flex min-h-[390px] flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              Self-Managed Review
            </p>

            <h3 className="mt-3 text-2xl font-black text-white">
              Your team handles the review
            </h3>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Your internal team manages the assessment with no Truvern Review credit required while Truvern provides
              the governance workspace, evidence management, review tracking,
              and release infrastructure.
            </p>

            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-200 marker:text-cyan-300">
              <li>Internal security team ownership</li>
              <li>Launch reviews directly</li>
              <li>Maintain governance history</li>
              <li>Centralized vendor evidence</li>
            </ul>
          </div>

          <a
            href="#start-assessment"
            className="mt-auto inline-flex w-fit rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Run Self-Managed Review
          </a>
        </article>
      </div>
    </section>
  );
}




