import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import SendToTruvernManagedReview from "@/components/vendors/send-to-truvern-managed-review.client";

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function safeInt(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export default async function ManagedVendorReviewPage({ params }: Props) {
  const resolved = await params;
  const vendorId = safeInt(resolved.id);

  if (!vendorId) notFound();

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      category: true,
      updatedAt: true,
      organizationId: true,
    },
  });

  if (!vendor) notFound();
  // MANAGED_REVIEW_CREDIT_BALANCE
  const creditRows = await prisma.$queryRaw<Array<{
    availableCredits: number;
    reservedCredits: number;
    consumedCredits: number;
  }>>`
    select
      coalesce(sum("availableDelta"), 0)::int as "availableCredits",
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
      coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = ${vendor?.organizationId}
      and status::text = 'POSTED'
  `;

  const managedReviewCreditBalance = creditRows[0] ?? {
    availableCredits: 0,
    reservedCredits: 0,
    consumedCredits: 0,
  };



  return (
    <main className="min-h-[100svh] bg-[#020617] px-6 py-6 text-white">
      <div className="mx-auto pb-28 max-w-5xl">
        <Link href={`/vendors/${vendor.id}`} className="text-sm text-cyan-200">
          ← Back to vendor profile
        </Link>

        <section className="mt-8 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-500/10">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            Truvern Review
          </div>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            Send {vendor.name} to Truvern Ops.
          </h1>

          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
            This path starts a dedicated Truvern-managed vendor governance
            review. Truvern Ops will coordinate questionnaire distribution,
            evidence review, findings, remediation, attestations, and the final
            governance release package.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              "Vendor outreach",
              "Evidence review",
              "Findings workflow",
              "Governance release",
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

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
          <h2 className="text-2xl font-black tracking-tight text-white">
            Legal and assurance acknowledgement
          </h2>

          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
            <p>
              Truvern Truvern Reviews are operational governance assessments
              based on information, evidence, attestations, and materials
              provided during the review process.
            </p>

            <p>
              Truvern findings, risk opinions, remediation guidance, and
              governance release records are point-in-time operational
              evaluations. They are not certifications, guarantees, legal
              determinations, or warranties of security, compliance, vendor
              performance, or regulatory standing.
            </p>

            <p>
              Final vendor approval, procurement decisions, legal review,
              compliance obligations, and risk acceptance remain the
              responsibility of the customer organization.
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-cyan-400/20 bg-[#081827]/80 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">
                Ready to start?
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Continuing will start the Truvern Review workflow and may reserve
                1 Truvern credit when credits are required for your organization.
              </p>
            </div>

            <SendToTruvernManagedReview
              vendorId={vendor.id}
              availableCredits={managedReviewCreditBalance.availableCredits}
              reservedCredits={managedReviewCreditBalance.reservedCredits}
              consumedCredits={managedReviewCreditBalance.consumedCredits}
            />
          </div>
        </section>
      </div>
    </main>
  );
}













