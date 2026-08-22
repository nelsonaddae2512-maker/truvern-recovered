import Link from "next/link";

import {
  listDeploymentLicenses,
  type DeploymentLicensePublicRecord,
} from "@/lib/licensing/deployment-license-service";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(
  value: Date | null,
) {
  if (!value) {
    return "No expiration";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
    },
  ).format(value);
}

function statusClasses(
  status:
    DeploymentLicensePublicRecord["status"],
) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";

    case "SUSPENDED":
      return "border-amber-400/25 bg-amber-500/10 text-amber-100";

    case "REVOKED":
      return "border-red-400/25 bg-red-500/10 text-red-100";

    case "EXPIRED":
      return "border-slate-400/25 bg-slate-500/10 text-slate-200";

    default:
      return "border-cyan-400/25 bg-cyan-500/10 text-cyan-100";
  }
}

export default async function DeploymentLicensesPage() {
  await requireTruvernOperator();

  const licenses =
    await listDeploymentLicenses();

  const active =
    licenses.filter(
      (license) =>
        license.status === "ACTIVE",
    ).length;

  const suspended =
    licenses.filter(
      (license) =>
        license.status === "SUSPENDED",
    ).length;

  const revoked =
    licenses.filter(
      (license) =>
        license.status === "REVOKED",
    ).length;

  const expiring =
    licenses.filter((license) => {
      if (
        license.status !== "ACTIVE" ||
        !license.expiresAt
      ) {
        return false;
      }

      const now =
        Date.now();

      const thirtyDays =
        30 *
        24 *
        60 *
        60 *
        1000;

      const expiration =
        license.expiresAt.getTime();

      return (
        expiration >= now &&
        expiration <=
          now + thirtyDays
      );
    }).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-white">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
            Truvern Ops
          </p>

          <h1 className="mt-3 text-4xl font-semibold">
            Deployment Licenses
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Internal control plane for customer-private
            and Truvern-operated deployment entitlements.
            This console intentionally exposes no license
            secrets.
          </p>
        </div>

        <Link
          href="/truvern/ops"
          className="inline-flex rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-white/[0.09]"
        >
          Back to Ops
        </Link>
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-4">
        <MetricCard
          label="Active"
          value={active}
          tone="emerald"
        />

        <MetricCard
          label="Suspended"
          value={suspended}
          tone="amber"
        />

        <MetricCard
          label="Revoked"
          value={revoked}
          tone="red"
        />

        <MetricCard
          label="Expiring within 30 days"
          value={expiring}
          tone="cyan"
        />
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
            License inventory
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            Deployment control plane
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Review deployment identity, environment,
            lifecycle state, expiration, and issuance
            metadata. Open a record for immutable audit
            history.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[1350px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.22em] text-slate-400">
              <tr>
                <th className="px-5 py-4">
                  Deployment
                </th>

                <th className="px-5 py-4">
                  Organization
                </th>

                <th className="px-5 py-4">
                  Type
                </th>

                <th className="px-5 py-4">
                  Status
                </th>

                <th className="px-5 py-4">
                  Environment
                </th>

                <th className="px-5 py-4">
                  Hostname
                </th>

                <th className="px-5 py-4">
                  Starts
                </th>

                <th className="px-5 py-4">
                  Expires
                </th>

                <th className="px-5 py-4">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {licenses.length ? (
                licenses.map(
                  (license) => (
                    <tr
                      key={license.id}
                      className="bg-slate-950/30"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">
                          {license.deploymentId}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          License #{license.id}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-200">
                        Organization #
                        {license.organizationId}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {license.type}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                            license.status,
                          )}`}
                        >
                          {license.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {license.environment ||
                          "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {license.hostname ||
                          "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {formatDate(
                          license.startsAt,
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {formatDate(
                          license.expiresAt,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          href={`/truvern/ops/deployment-licenses/${license.id}`}
                          className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/20"
                        >
                          Inspect
                        </Link>
                      </td>
                    </tr>
                  ),
                )
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    No deployment licenses
                    have been issued.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
        <p className="text-sm font-semibold text-amber-100">
          Secret handling boundary
        </p>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-amber-50/80">
          This inventory never displays license
          credentials or credential hashes.
          Plaintext credentials remain restricted
          to issuance and key rotation responses.
        </p>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:
    | "cyan"
    | "emerald"
    | "amber"
    | "red";
}) {
  const classes = {
    cyan:
      "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",

    emerald:
      "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",

    amber:
      "border-amber-400/20 bg-amber-500/10 text-amber-100",

    red:
      "border-red-400/20 bg-red-500/10 text-red-100",
  }[tone];

  return (
    <div
      className={`rounded-3xl border p-5 ${classes}`}
    >
      <p className="text-sm">
        {label}
      </p>

      <p className="mt-3 text-4xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}