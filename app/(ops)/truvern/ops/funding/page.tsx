import Link from "next/link";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";
import {
  resolveOrganizationPlan,
  type OrganizationPlanResolution,
} from "@/lib/billing/organization-plan";
import {
  readOpsFundingOverview,
  readOpsFundingPortfolioSummary,
  readOpsFundingLowBalanceOrganizations,
  readOpsFundingHighConsumptionOrganizations,
  readOpsRecentCreditPurchases,
  normalizeOpsFundingPage,
  OPS_FUNDING_PAGE_SIZE,
} from "@/lib/repositories/ops-funding-overview-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type AnyRow = Record<string, any>;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function safeInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export default async function TruvernOpsFundingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await requireTruvernOperator();

  const params = await searchParams;
  const summary = await readOpsFundingPortfolioSummary();
  const requestedPage = normalizeOpsFundingPage(params.page);
  const pageCount = Math.max(
    1,
    Math.ceil(summary.organizations / OPS_FUNDING_PAGE_SIZE),
  );
  const currentPage = Math.min(requestedPage, pageCount);

  const orgRows: AnyRow[] =
    await readOpsFundingOverview(currentPage);

  const organizationPlans = new Map<number, OrganizationPlanResolution>();

  // Bound database concurrency while reusing the commercial
  // entitlement resolver already used throughout Truvern.
  const planBatchSize = 10;

  for (let offset = 0; offset < orgRows.length; offset += planBatchSize) {
    const batch = orgRows.slice(offset, offset + planBatchSize);

    const resolved = await Promise.all(
      batch.map(async (org) => {
        const organizationId = Number(org.id);

        return {
          organizationId,
          resolution: await resolveOrganizationPlan(organizationId),
        };
      }),
    );

    for (const item of resolved) {
      organizationPlans.set(item.organizationId, item.resolution);
    }
  }

  const totalAvailableCredits = summary.availableCredits;
  const lowBalanceOrgs: AnyRow[] =
    await readOpsFundingLowBalanceOrganizations();
  const highConsumptionOrgs: AnyRow[] =
    await readOpsFundingHighConsumptionOrganizations();

  const recentPurchases: AnyRow[] =
    await readOpsRecentCreditPurchases();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
            Truvern Ops
          </p>

          <h1 className="mt-3 text-4xl font-semibold">
            Funding & Override Command Center
          </h1>

          <p className="mt-3 max-w-3xl text-sm text-slate-300">
            View customer network funding posture, review activity, and prepare
            manual credit grants plus PRO / Enterprise overrides for pilots,
            demos, and customer enablement.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
  <Link
    href="/dashboard"
    className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-white/[0.09]"
  >
    Customer dashboard
  </Link>

  <Link
    href="/truvern/ops/funding"
    className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/20"
  >
    Funding Console
  </Link>
</div>
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5">
          <p className="text-sm text-cyan-100">Organizations</p>
          <p className="mt-3 text-3xl font-semibold">{summary.organizations}</p>
        </div>

        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
          <p className="text-sm text-emerald-100">Available credits</p>
          <p className="mt-3 text-3xl font-semibold">
            {totalAvailableCredits}
          </p>
        </div>

        <div className="rounded-3xl border border-violet-400/20 bg-violet-500/10 p-5">
          <p className="text-sm text-violet-100">Total reviews</p>
          <p className="mt-3 text-3xl font-semibold">
            {summary.totalReviews}
          </p>
        </div>

        <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
          <p className="text-sm text-amber-100">Manual controls</p>
          <p className="mt-3 text-3xl font-semibold">Ready</p>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-100">
            Low balance watch
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            {summary.lowBalanceOrganizations} organizations
          </h2>
          <div className="mt-4 space-y-2">
            {lowBalanceOrgs.slice(0, 5).map((org) => (
              <Link
                key={String(org.id)}
                href={`/truvern/ops/funding/${org.id}`}
                className="block rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm hover:bg-white/[0.06]"
              >
                <span className="font-semibold text-white">
                  {safeStr(org.name) || `Organization #${org.id}`}
                </span>
                <span className="ml-2 text-amber-100">
                  {safeInt(org.availableCredits)} available
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-purple-400/20 bg-purple-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-purple-100">
            Highest consumption
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Credit velocity
          </h2>
          <div className="mt-4 space-y-2">
            {highConsumptionOrgs.map((org) => (
              <Link
                key={String(org.id)}
                href={`/truvern/ops/funding/${org.id}`}
                className="block rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm hover:bg-white/[0.06]"
              >
                <span className="font-semibold text-white">
                  {safeStr(org.name) || `Organization #${org.id}`}
                </span>
                <span className="ml-2 text-purple-100">
                  {safeInt(org.consumedCredits)} consumed
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-100">
            Recent purchases
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Stripe funding
          </h2>
          <div className="mt-4 space-y-2">
            {recentPurchases.length ? (
              recentPurchases.slice(0, 5).map((purchase) => (
                <Link
                  key={String(purchase.id)}
                  href={`/truvern/ops/funding/${purchase.organizationId}`}
                  className="block rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm hover:bg-white/[0.06]"
                >
                  <span className="font-semibold text-white">
                    {safeStr(purchase.organizationName) ||
                      `Organization #${purchase.organizationId}`}
                  </span>
                  <span className="ml-2 text-emerald-100">
                    +{safeInt(purchase.quantity)} credits
                  </span>
                </Link>
              ))
            ) : (
              <p className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
                No Stripe purchases yet.
              </p>
            )}
          </div>
        </div>
      </section>
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
            Network funding posture
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            Customer organizations
          </h2>
        </div>

        <div className="mt-6 max-w-full overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[1200px] border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.25em] text-slate-400">
              <tr>
                <th scope="col" className="sticky left-0 z-20 min-w-[210px] bg-slate-900 px-5 py-4 shadow-[6px_0_12px_-8px_rgba(0,0,0,0.8)]">Organization</th>
                <th className="px-5 py-4">Slug</th>
                <th className="px-5 py-4">Vendors</th>
                <th className="px-5 py-4">Reviews</th>
                <th className="px-5 py-4">Credits</th>
                <th className="px-5 py-4">Effective</th>
                <th className="px-5 py-4">Plan override</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {orgRows.length ? (
                orgRows.map((org) => (
                  <tr key={String(org.id)} className="bg-slate-950/30">
                    <td className="sticky left-0 z-10 min-w-[210px] bg-slate-950 px-5 py-4 shadow-[6px_0_12px_-8px_rgba(0,0,0,0.8)]">
                      <p className="font-semibold text-white">
                        {safeStr(org.name) || `Organization #${org.id}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Org #{org.id}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      {safeStr(org.slug) || "—"}
                    </td>

                    <td className="px-5 py-4 text-slate-200">
                      {safeInt(org.vendorCount)}
                    </td>

                    <td className="px-5 py-4 text-slate-200">
                      {safeInt(org.reviewCount)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="space-y-1 text-xs">
                        <p className="text-emerald-200">
                          Available: {safeInt(org.availableCredits)}
                        </p>
                        <p className="text-amber-200">
                          Reserved: {safeInt(org.reservedCredits)}
                        </p>
                        <p className="text-slate-400">
                          Consumed: {safeInt(org.consumedCredits)}
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-white">
                          {organizationPlans.get(Number(org.id))?.planTier ?? "FREE"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {organizationPlans.get(Number(org.id))?.source === "OVERRIDE"
                            ? "Ops override"
                            : organizationPlans.get(Number(org.id))?.source === "SUBSCRIPTION"
                              ? "Paid subscription"
                              : "Free access"}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {organizationPlans.get(Number(org.id))?.source === "OVERRIDE" ? (
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                          {organizationPlans.get(Number(org.id))?.planTier}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">None</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex min-w-[100px] flex-col items-start gap-2">
                        <Link
                          href={`/truvern/ops/funding/${org.id}`}
                          className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/20"
                        >
                          Manage
                        </Link>

                        <Link
                          href={`/truvern/ops/network?orgId=${org.id}`}
                          className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.09]"
                        >
                          Network
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-slate-400">
                    No organizations found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <nav
          aria-label="Funding organization pages"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <p className="text-slate-300">
            Page {currentPage} of {pageCount} - {summary.organizations} organizations
          </p>
          <div className="flex gap-2">
            {currentPage > 1 ? (
              <Link
                href={`/truvern/ops/funding?page=${currentPage - 1}`}
                className="rounded-xl border border-white/20 px-4 py-2 text-white hover:bg-white/10"
              >
                Previous
              </Link>
            ) : null}
            {currentPage < pageCount ? (
              <Link
                href={`/truvern/ops/funding?page=${currentPage + 1}`}
                className="rounded-xl border border-white/20 px-4 py-2 text-white hover:bg-white/10"
              >
                Next
              </Link>
            ) : null}
          </div>
        </nav>      </section>
    </main>
  );
}













