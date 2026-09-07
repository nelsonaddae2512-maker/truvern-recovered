import Link from "next/link";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ComprehensiveReviewsPage() {
  await requireOpsAccess();

  const vendors = await prisma.vendor.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      category: true,
      criticality: true,
      status: true,
      organization: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [
      {
        organizationId: "asc",
      },
      {
        name: "asc",
      },
      {
        id: "asc",
      },
    ],
    take: 500,
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/truvern/ops/library"
            className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
          >
            ? Back to Governance Assessment Library
          </Link>
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/20">
          <div className="max-w-4xl">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Truvern Ops
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Select vendor for comprehensive NIST review
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
              Select an existing vendor for the certified comprehensive
              NIST SP 800-53 Rev. 5.2.0 governance review. Selecting a vendor
              does not create an assessment or reserve a credit. You will
              review the vendor and canonical assessment scope before
              creating the assessment.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-2xl font-semibold text-white">
                {vendors.length}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                available vendors
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-2xl font-semibold text-white">
                1,196
              </div>
              <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                canonical controls
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-2xl font-semibold text-white">
                301
              </div>
              <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                certified questions
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-lg font-semibold text-white">
              Vendor portfolio
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Truvern Ops can select vendors across customer organizations.
              Deleted vendors are excluded.
            </p>
          </div>

          {vendors.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-base font-semibold text-white">
                No eligible vendors found
              </div>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
                No non-deleted vendors are currently available to Truvern Ops.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-white">
                        {vendor.name}
                      </h3>

                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300">
                        Vendor #{vendor.id}
                      </span>

                      {vendor.status ? (
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs text-emerald-100">
                          {vendor.status}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 text-sm text-slate-300">
                      {vendor.organization.name}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>
                        Organization #{vendor.organizationId}
                      </span>

                      <span>
                        {vendor.organization.slug}
                      </span>

                      {vendor.category ? (
                        <span>
                          Category: {vendor.category}
                        </span>
                      ) : null}

                      {vendor.criticality ? (
                        <span>
                          Criticality: {vendor.criticality}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Link
                      href={`/truvern/ops/comprehensive-reviews/${vendor.id}`}
                      className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                    >
                      Select vendor
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-5 py-4">
          <div className="text-sm font-semibold text-amber-100">
            No assessment has been created yet
          </div>

          <p className="mt-1 text-sm leading-6 text-amber-100/70">
            Vendor selection is navigation only. Credit reservation and
            comprehensive assessment creation occur only after confirmation
            on the next screen.
          </p>
        </section>
      </div>
    </main>
  );
}