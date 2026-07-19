import Link from "next/link";
import prisma from "@/lib/prisma";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";

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

export default async function TruvernOpsFundingPage() {
  await requireTruvernOperator();

  const orgRows: AnyRow[] = await prisma.$queryRawUnsafe(`
    select
      o.id,
      o.name,
      o.slug,
      o."createdAt",
      count(distinct v.id)::int as "vendorCount",
      count(distinct ra.id)::int as "reviewCount",
      coalesce(c."availableCredits", 0)::int as "availableCredits",
      coalesce(c."reservedCredits", 0)::int as "reservedCredits",
      coalesce(c."consumedCredits", 0)::int as "consumedCredits",
      (
        coalesce(c."availableCredits", 0)
        + coalesce(c."reservedCredits", 0)
        - coalesce(c."consumedCredits", 0)
      )::int as "effectiveCredits"
    from "Organization" o
    left join "Vendor" v on v."organizationId" = o.id
    left join "ReviewRequest" rr on rr."vendorId" = v.id
    left join "ReviewAssignment" ra on ra."reviewRequestId" = rr.id
    left join (
      select
        "organizationId",
        coalesce(sum("availableDelta"), 0)::int as "availableCredits",
        coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
        coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
      from "TruvernCreditLedgerEntry"
      group by "organizationId"
    ) c on c."organizationId" = o.id
    group by
      o.id,
      c."availableCredits",
      c."reservedCredits",
      c."consumedCredits"
    order by o."createdAt" desc
    limit 100
  `);

  const totalAvailableCredits = orgRows.reduce(
    (sum, row) => sum + safeInt(row.availableCredits),
    0,
  );

  const lowBalanceOrgs = orgRows.filter(
    (row: AnyRow) => safeInt(row.availableCredits) <= 5,
  );

  const highConsumptionOrgs = [...orgRows]
    .sort(
      (a: AnyRow, b: AnyRow) =>
        safeInt(b.consumedCredits) - safeInt(a.consumedCredits),
    )
    .slice(0, 5);

  const recentPurchases: AnyRow[] = await prisma.$queryRawUnsafe(`
    select
      l.id,
      l."organizationId",
      o.name as "organizationName",
      l.quantity,
      l.note,
      l."createdAt"
    from "TruvernCreditLedgerEntry" l
    left join "Organization" o
      on o.id = l."organizationId"
    where l."entryType"::text = 'PURCHASE'
    order by l."createdAt" desc
    limit 10
  `);

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
          <p className="mt-3 text-3xl font-semibold">{orgRows.length}</p>
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
            {orgRows.reduce((sum, row) => sum + safeInt(row.reviewCount), 0)}
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
            {lowBalanceOrgs.length} organizations
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

        <div className="mt-6 overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.25em] text-slate-400">
              <tr>
                <th className="px-5 py-4">Organization</th>
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
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">
                        {safeStr(org.name) || `Organization #${org.id}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Org #{org.id}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      {safeStr(org.slug) || "Ã¢‚¬€"}
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
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
                          PRO override
                        </span>
                        <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-100">
                          Enterprise override
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
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
      </section>
    </main>
  );
}













