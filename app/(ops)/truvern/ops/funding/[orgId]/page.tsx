import prisma from "@/lib/prisma";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";
import { resolveOrganizationPlanTier } from "@/lib/billing/organization-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ orgId: string }>;
  searchParams?: Promise<{ status?: string }>;
};

type AnyRow = Record<string, any>;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function safeInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export default async function TruvernOpsFundingOrgPage({
  params,
  searchParams,
}: Props) {
  await requireTruvernOperator();

  const resolved = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const status = safeStr(resolvedSearchParams?.status);

  const organizationId = safeInt(resolved?.orgId);

  if (!organizationId) {
    return (
      <main className="p-10 text-white">
        Invalid organization id.
      </main>
    );
  }

  const orgRows: AnyRow[] = await prisma.$queryRawUnsafe(
    `
    select *
    from "Organization"
    where id = $1
    limit 1
    `,
    organizationId,
  );

  const org = orgRows?.[0];

  if (!org) {
    return (
      <main className="p-10 text-white">
        Organization not found.
      </main>
    );
  }

  const effectivePlanTier =
    await resolveOrganizationPlanTier(organizationId);

  const overrideRows: AnyRow[] = await prisma.$queryRawUnsafe(
    `
    select *
    from "OrganizationPlanOverride"
    where "organizationId" = $1
      and "revokedAt" is null
    order by "createdAt" desc, id desc
    limit 1
    `,
    organizationId,
  );

  const activeOverride = overrideRows?.[0] || null;

  const ledgerRows: AnyRow[] = await prisma.$queryRawUnsafe(
    `
    select *
    from "TruvernCreditLedgerEntry"
    where "organizationId" = $1
    order by "createdAt" desc, id desc
    limit 100
    `,
    organizationId,
  );

  const balanceRows: AnyRow[] = await prisma.$queryRawUnsafe(
    `
    select
      coalesce(sum("availableDelta"), 0)::int as "availableCredits",
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
      coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = $1
    `,
    organizationId,
  );

  const availableCredits = safeInt(
    balanceRows?.[0]?.availableCredits,
  );

  const reservedCredits = safeInt(
    balanceRows?.[0]?.reservedCredits,
  );

  const consumedCredits = safeInt(
    balanceRows?.[0]?.consumedCredits,
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-white">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
          Truvern Ops Funding
        </p>

        <h1 className="mt-3 text-4xl font-semibold">
          {safeStr(org.name) || `Organization #${organizationId}`}
        </h1>

        <p className="mt-3 text-sm text-slate-400">
          Immutable credit grants, overrides, and funding operations.
        </p>
      </div>

      {status ? (
        <div className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-emerald-50">
          <p className="text-sm font-semibold">
            {status === "credits-granted"
              ? "Pilot credits granted successfully."
              : status === "plan-override-applied"
                ? "Organization plan override applied successfully."
                : "Funding operation completed successfully."}
          </p>
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
          <p className="text-sm text-emerald-100">
            Available credits
          </p>

          <p className="mt-3 text-4xl font-semibold">
            {availableCredits}
          </p>
        </div>

        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5">
          <p className="text-sm text-cyan-100">
            Reserved credits
          </p>

          <p className="mt-3 text-4xl font-semibold">
            {reservedCredits}
          </p>
        </div>

        <div className="rounded-3xl border border-violet-400/20 bg-violet-500/10 p-5">
          <p className="text-sm text-violet-100">
            Consumed credits
          </p>

          <p className="mt-3 text-4xl font-semibold">
            {consumedCredits}
          </p>
        </div>

        <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
          <p className="text-sm text-amber-100">
            Effective plan
          </p>

          <p className="mt-3 text-3xl font-semibold">
            {effectivePlanTier}
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-semibold">
            Grant pilot credits
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Issue promotional or enablement credits directly into the immutable ledger.
          </p>

          <form
            action={`/api/truvern/ops/orgs/${organizationId}/credit-grant`}
            method="POST"
            className="mt-6 grid gap-4"
          >
            <div>
              <label className="text-sm text-slate-300">
                Credits
              </label>

              <input
                type="number"
                name="amount"
                min={1}
                defaultValue={25}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-slate-300">
                Reason
              </label>

              <textarea
                name="reason"
                rows={4}
                defaultValue="Pilot enablement credits"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
              />
            </div>

            <button
              type="submit"
              className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-50 hover:bg-emerald-500/20"
            >
              Grant credits
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-semibold">
            Organization plan override
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Temporarily unlock PRO or ENTERPRISE capabilities for pilot organizations.
          </p>

          <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-100">
              Active override
            </p>

            <p className="mt-2 text-2xl font-semibold text-white">
              {safeStr(activeOverride?.planTier) || "None"}
            </p>

            <p className="mt-2 text-xs text-slate-300">
              {safeStr(activeOverride?.reason) || "No active override"}
            </p>
          </div>

          <form
            action={`/api/truvern/ops/orgs/${organizationId}/plan-override`}
            method="POST"
            className="mt-6 grid gap-4"
          >
            <div>
              <label className="text-sm text-slate-300">
                Override tier
              </label>

              <select
                name="planTier"
                defaultValue="PRO"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
              >
                <option value="FREE">FREE</option>
                <option value="PRO">PRO</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300">
                Expiration
              </label>

              <input
                type="datetime-local"
                name="expiresAt"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-slate-300">
                Reason
              </label>

              <textarea
                name="reason"
                rows={4}
                defaultValue="Pilot PRO enablement"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
              />
            </div>

            <button
              type="submit"
              className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-5 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/20"
            >
              Apply override
            </button>
          </form>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Immutable activity stream
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Funding & governance timeline
            </h2>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
              Grants
            </span>

            <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">
              Reservations
            </span>

            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-violet-100">
              Consumption
            </span>

            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">
              Reversals
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {ledgerRows.length ? (
            ledgerRows.map((entry) => (
              <div
                key={String(entry.id)}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      {safeStr(entry.entryType) || "ENTRY"}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {safeStr(entry.note) || "No note provided"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                      {safeStr(entry.entryType) || "ENTRY"}
                    </span>

                    <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                      Available {safeInt(entry.availableDelta)}
                    </span>

                    <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                      Reserved {safeInt(entry.reservedDelta)}
                    </span>

                    <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-100">
                      Consumed {safeInt(entry.consumedDelta)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Actor
                    </p>

                    <p className="mt-2 text-xs text-slate-100">
                      {safeStr(entry.actorUserId) || "Unknown"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Timestamp
                    </p>

                    <p className="mt-2 text-xs text-slate-100">
                      {safeStr(entry.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-slate-400">
              No ledger entries yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}



