import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";
import ComprehensiveReviewLauncher from "@/components/truvern-ops/comprehensive-review-launcher.client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params:
    | Promise<{ vendorId: string }>
    | { vendorId: string };
};

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

export default async function ComprehensiveReviewVendorPage({
  params,
}: Props) {
  await requireOpsAccess();

  const resolvedParams = await params;

  const vendorId =
    parsePositiveInt(resolvedParams.vendorId);

  if (!vendorId) {
    return notFound();
  }

  const vendor =
    await prisma.vendor.findUnique({
      where: {
        id: vendorId,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        category: true,
        criticality: true,
        status: true,
      },
    });

  if (!vendor) {
    return notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/truvern/ops/library"
        className="text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
      >
        ← Back to Truvern Ops Library
      </Link>

      <section className="mt-6 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-950/20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
          Truvern Ops · Comprehensive NIST Review
        </p>

        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">
          {vendor.name}
        </h1>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          Prepare a vendor-bound comprehensive NIST SP 800-53 assessment
          using Truvern's certified canonical governance framework.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Vendor ID
            </div>
            <div className="mt-2 font-semibold text-white">
              #{vendor.id}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Organization
            </div>
            <div className="mt-2 font-semibold text-white">
              #{vendor.organizationId}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Category
            </div>
            <div className="mt-2 font-semibold text-white">
              {vendor.category || "Not classified"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Criticality
            </div>
            <div className="mt-2 font-semibold text-white">
              {vendor.criticality || "Not classified"}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Canonical launch boundary
        </p>

        <h2 className="mt-3 text-2xl font-semibold text-white">
          Comprehensive assessment launch
        </h2>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          Create the Truvern review assignment and bind it directly to
          the certified canonical NIST SP 800-53 assessment. This path
          does not invoke the operational 120-question questionnaire.
        </p>

        <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5 text-sm leading-6 text-cyan-100">
          Canonical scope: 1,196 controls with the certified 301-question
          comprehensive governance questionnaire.
        </div>

        <ComprehensiveReviewLauncher
          vendorId={vendor.id}
        />
      </section>
    </main>
  );
}