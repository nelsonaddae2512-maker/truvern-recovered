import Link from "next/link";
import { redirect } from "next/navigation";

import { requireDbOrganization } from "@/lib/org-db";
import { readCustomerCisoReports } from "@/lib/repositories/customer-ciso-reports-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(
  value: Date | null,
) {
  if (!value) {
    return "Not recorded";
  }

  return value.toLocaleString();
}

function displayState(
  value: string,
) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (match) =>
        match.toUpperCase(),
    );
}

export default async function CisoReportsPage() {
  const org =
    await requireDbOrganization();

  if ("_needsOrgSelection" in org) {
    redirect("/dashboard");
  }

  const reports =
    await readCustomerCisoReports(
      org.id,
    );

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Executive governance
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              CISO Reports
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Access released governance reports for your organization.
              Each report is backed by Truvern&apos;s immutable governance
              release record and its secured assessment packet.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Released reports
            </p>

            <p className="mt-1 text-2xl font-semibold text-white">
              {reports.length}
            </p>
          </div>
        </div>

        {reports.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-lg font-semibold text-white">
              No released CISO reports yet
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Reports will appear here after a governance review has
              completed its release lifecycle.
            </p>

            <div className="mt-6">
              <Link
                href="/vendors"
                className="inline-flex rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
              >
                View vendors
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">
                      Vendor
                    </th>

                    <th className="px-6 py-4 font-medium">
                      Release state
                    </th>

                    <th className="px-6 py-4 font-medium">
                      Released
                    </th>

                    <th className="px-6 py-4 font-medium">
                      Confirmed
                    </th>

                    <th className="px-6 py-4 text-right font-medium">
                      Report
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {reports.map(
                    (report) => (
                      <tr
                        key={report.id}
                        className="transition hover:bg-white/[0.03]"
                      >
                        <td className="px-6 py-5">
                          <p className="font-semibold text-white">
                            {report.vendorName}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Review #{report.reviewAssignmentId}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                            {displayState(
                              report.releaseState,
                            )}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-slate-300">
                          {formatDate(
                            report.releasedAt,
                          )}
                        </td>

                        <td className="px-6 py-5 text-slate-300">
                          {formatDate(
                            report.confirmedAt,
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/ciso-reports/${report.reviewAssignmentId}`}
                              className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                            >
                              Open report
                            </Link>

                            <Link
                              href={`/ciso-reports/${report.reviewAssignmentId}/pdf`}
                              target="_blank"
                              className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                            >
                              PDF
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
