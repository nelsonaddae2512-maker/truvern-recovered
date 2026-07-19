import Link from "next/link";
import prisma from "@/lib/prisma";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";
import {
  getGovernanceHealthMeta,
  getGovernanceHealthState,
} from "@/lib/governance/governance-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type HealthFilter =
  | "all"
  | "healthy"
  | "watch"
  | "at-risk"
  | "expired";

function normalizeHealthFilter(value: unknown): HealthFilter {
  const v = typeof value === "string" ? value : "";

  if (
    v === "healthy" ||
    v === "watch" ||
    v === "at-risk" ||
    v === "expired"
  ) {
    return v;
  }

  return "all";
}

type Row = {
  assignmentId: number;
  vendorName: string | null;
  updatedAt: Date | string | null;
  manifestId: number | null;
};

export default async function GovernanceHealthPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined> }) {
  await requireTruvernOperator();

  const resolvedSearchParams = await searchParams;
  const filter = normalizeHealthFilter(
    resolvedSearchParams?.filter,
  );

  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    select
      ra.id as "assignmentId",
      v.name as "vendorName",
      ra."updatedAt",
      gm.id as "manifestId"

    from "ReviewAssignment" ra

    left join "ReviewRequest" rr
      on rr.id = ra."reviewRequestId"

    left join "Vendor" v
      on v.id = rr."vendorId"

    left join lateral (
      select id, responses
      from "ReviewResponse"
      where "reviewAssignmentId" = ra.id
      order by "updatedAt" desc
      limit 1
    ) latest on true

    left join "GovernanceReleaseManifest" gm
      on gm."reviewResponseId" = latest.id

    where
      upper(coalesce(latest.responses->>'releaseState', '')) = 'CONFIRMED'

    order by ra."updatedAt" asc

    limit 100
  `);

  const filteredRows = rows.filter((row) => {
    const state = getGovernanceHealthState(row.updatedAt);

    if (filter === "healthy") return state === "HEALTHY";
    if (filter === "watch") return state === "WATCH";
    if (filter === "at-risk") return state === "AT_RISK";
    if (filter === "expired") return state === "EXPIRED";

    return true;
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
            Continuous Governance
          </p>

          <h1 className="mt-2 text-4xl font-semibold">
            Governance Health Monitor
          </h1>
        </div>

        <Link
          href="/truvern/ops/reviews"
          className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/[0.08]"
        >
          Back to Ops Reviews
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {[
          ["all", "All"],
          ["healthy", "Healthy"],
          ["watch", "Watch"],
          ["at-risk", "At Risk"],
          ["expired", "Expired"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/truvern/ops/governance-health?filter=${value}`}
            className={`rounded-2xl border px-4 py-2 text-xs font-semibold ${
              filter === value
                ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-slate-400">
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Assignment</th>
              <th className="px-4 py-3">Governance Health</th>
              <th className="px-4 py-3">Manifest</th>
              <th className="px-4 py-3">Finalized</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => {
              const health = getGovernanceHealthMeta(
                getGovernanceHealthState(row.updatedAt),
              );

              const filteredRows = rows.filter((row) => {
    const state = getGovernanceHealthState(row.updatedAt);

    if (filter === "healthy") return state === "HEALTHY";
    if (filter === "watch") return state === "WATCH";
    if (filter === "at-risk") return state === "AT_RISK";
    if (filter === "expired") return state === "EXPIRED";

    return true;
  });

  return (
                <tr
                  key={row.assignmentId}
                  className="border-b border-white/5 text-slate-200"
                >
                  <td className="px-4 py-4 font-medium text-white">
                    {row.vendorName || "Unknown vendor"}
                  </td>

                  <td className="px-4 py-4">
                    #{row.assignmentId}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${health.className}`}
                    >
                      {health.label}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    {row.manifestId ? (
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                        #{row.manifestId}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>

                  <td className="px-4 py-4 text-slate-400">
                    {row.updatedAt
                      ? new Date(row.updatedAt).toLocaleString()
                      : "—"}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/review-desk?assignmentId=${row.assignmentId}`}
                        className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/15"
                      >
                        Open Review
                      </Link>

                      {row.manifestId ? (
                        <Link
                          href={`/api/governance/manifests/${row.manifestId}`}
                          target="_blank"
                          className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/15"
                        >
                          View Manifest
                        </Link>
                      ) : null}

                      <Link
                        href={`/review-desk?assignmentId=${row.assignmentId}&intent=reassessment`}
                        className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/15"
                      >
                        Request Reassessment
                      </Link>

                      <Link
                        href={`/review-desk?assignmentId=${row.assignmentId}&intent=escalate-risk`}
                        className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/15"
                      >
                        Escalate Risk
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}







