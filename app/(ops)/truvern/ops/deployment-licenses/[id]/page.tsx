import Link from "next/link";
import LicenseLifecycleControls from "./license-lifecycle-controls.client";
import { notFound } from "next/navigation";

import {
  getDeploymentLicense,
  type DeploymentLicensePublicRecord,
} from "@/lib/licensing/deployment-license-service";
import prisma from "@/lib/prisma";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function parsePositiveInteger(
  value: string,
) {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function formatDateTime(
  value: Date | null,
) {
  if (!value) {
    return "â€”";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
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

function auditTone(
  action: string,
) {
  switch (action) {
    case "ISSUED":
    case "REACTIVATED":
      return "border-emerald-400/20 bg-emerald-500/10";

    case "SUSPENDED":
    case "EXPIRATION_UPDATED":
      return "border-amber-400/20 bg-amber-500/10";

    case "REVOKED":
      return "border-red-400/20 bg-red-500/10";

    case "KEY_ROTATED":
      return "border-cyan-400/20 bg-cyan-500/10";

    default:
      return "border-white/10 bg-white/[0.04]";
  }
}

export default async function DeploymentLicenseDetailPage({
  params,
}: PageProps) {
  await requireTruvernOperator();

  const { id } =
    await params;

  const licenseId =
    parsePositiveInteger(id);

  if (!licenseId) {
    notFound();
  }

  const license =
    await getDeploymentLicense(
      licenseId,
    );

  if (!license) {
    notFound();
  }

  const [
    organization,
    audit,
  ] =
    await Promise.all([
      prisma.organization.findUnique({
        where: {
          id:
            license.organizationId,
        },
        select: {
          id: true,
          name: true,
        },
      }),

      prisma.deploymentLicenseAudit.findMany({
        where: {
          deploymentLicenseId:
            license.id,
        },
        orderBy: [
          {
            createdAt: "asc",
          },
          {
            id: "asc",
          },
        ],
        select: {
          id: true,
          action: true,
          actorUserId: true,
          reason: true,
          previousStatus: true,
          newStatus: true,
          previousExpiresAt: true,
          newExpiresAt: true,
          createdAt: true,
        },
      }),
    ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-white">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Truvern Ops Â· Deployment License
            </p>

            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                license.status,
              )}`}
            >
              {license.status}
            </span>
          </div>

          <h1 className="mt-3 break-all text-3xl font-semibold lg:text-4xl">
            {license.deploymentId}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Read-only deployment entitlement record and
            immutable lifecycle audit history.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/truvern/ops/deployment-licenses"
            className="inline-flex rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-white/[0.09]"
          >
            License inventory
          </Link>

          <Link
            href="/truvern/ops"
            className="inline-flex rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-white/[0.09]"
          >
            Ops Command Center
          </Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Organization"
          value={
            organization?.name ||
            `Organization #${license.organizationId}`
          }
          detail={`ID ${license.organizationId}`}
        />

        <SummaryCard
          label="License type"
          value={license.type}
          detail={`License #${license.id}`}
        />

        <SummaryCard
          label="Environment"
          value={
            license.environment ||
            "Not specified"
          }
          detail={
            license.hostname ||
            "No hostname bound"
          }
        />

        <SummaryCard
          label="Expiration"
          value={
            license.expiresAt
              ? formatDateTime(
                  license.expiresAt,
                )
              : "No expiration"
          }
          detail={
            license.status ===
            "REVOKED"
              ? "License revoked"
              : "Current lifecycle term"
          }
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
            License record
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            Deployment entitlement
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field
              label="Deployment ID"
              value={
                license.deploymentId
              }
              mono
            />

            <Field
              label="License ID"
              value={
                String(
                  license.id,
                )
              }
            />

            <Field
              label="Organization"
              value={
                organization?.name ||
                `Organization #${license.organizationId}`
              }
            />

            <Field
              label="Organization ID"
              value={
                String(
                  license.organizationId,
                )
              }
            />

            <Field
              label="Type"
              value={license.type}
            />

            <Field
              label="Status"
              value={license.status}
            />

            <Field
              label="Environment"
              value={
                license.environment ||
                "Not specified"
              }
            />

            <Field
              label="Hostname"
              value={
                license.hostname ||
                "Not specified"
              }
              mono
            />

            <Field
              label="Issued"
              value={
                formatDateTime(
                  license.issuedAt,
                )
              }
            />

            <Field
              label="Starts"
              value={
                formatDateTime(
                  license.startsAt,
                )
              }
            />

            <Field
              label="Expires"
              value={
                license.expiresAt
                  ? formatDateTime(
                      license.expiresAt,
                    )
                  : "No expiration"
              }
            />

            <Field
              label="Revoked"
              value={
                license.revokedAt
                  ? formatDateTime(
                      license.revokedAt,
                    )
                  : "Not revoked"
              }
            />

            <Field
              label="Created by"
              value={
                license.createdByUserId ||
                "Not recorded"
              }
              mono
            />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Internal notes
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {license.notes ||
                "No internal notes recorded."}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-100">
            Security boundary
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            Secret-free operator view
          </h2>

          <p className="mt-3 text-sm leading-6 text-amber-50/80">
            This screen intentionally cannot display the
            deployment credential or its stored hash.
            Credential material is available only as
            one-time output from issuance or key rotation.
          </p>

          <div className="mt-6 space-y-3 text-sm">
            <BoundaryItem>
              Plaintext credential is not persisted.
            </BoundaryItem>

            <BoundaryItem>
              Stored credential hash is not exposed.
            </BoundaryItem>

            <BoundaryItem>
              Historical credential values are unrecoverable.
            </BoundaryItem>

            <BoundaryItem>
              Lifecycle history remains visible for audit.
            </BoundaryItem>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Immutable audit history
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              License lifecycle
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Chronological record of issuance and subsequent
              administrative lifecycle changes.
            </p>
          </div>

          <p className="text-sm text-slate-400">
            {audit.length}{" "}
            {audit.length === 1
              ? "event"
              : "events"}
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {audit.length ? (
            audit.map(
              (
                event,
                index,
              ) => (
                <article
                  key={event.id}
                  className={`rounded-2xl border p-5 ${auditTone(
                    event.action,
                  )}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-white/10 bg-slate-950/40 px-2 text-xs font-semibold text-slate-300">
                          {index + 1}
                        </span>

                        <h3 className="font-semibold text-white">
                          {event.action}
                        </h3>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-200">
                        {event.reason ||
                          "No reason recorded."}
                      </p>
                    </div>

                    <div className="text-sm text-slate-400 lg:text-right">
                      <p>
                        {formatDateTime(
                          event.createdAt,
                        )}
                      </p>

                      <p className="mt-1 break-all text-xs">
                        Actor:{" "}
                        {event.actorUserId ||
                          "Not recorded"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <TransitionField
                      label="Status transition"
                      before={
                        event.previousStatus ||
                        "-"
                      }
                      after={
                        event.newStatus ||
                        "-"
                      }
                    />

                    <TransitionField
                      label="Expiration transition"
                      before={
                        event.previousExpiresAt
                          ? formatDateTime(
                              event.previousExpiresAt,
                            )
                          : "-"
                      }
                      after={
                        event.newExpiresAt
                          ? formatDateTime(
                              event.newExpiresAt,
                            )
                          : "-"
                      }
                    />
                  </div>
                </article>
              ),
            )
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-5 py-10 text-center text-sm text-slate-400">
              No lifecycle audit events are recorded.
            </div>
          )}
        </div>
      </section>

      <LicenseLifecycleControls
        licenseId={license.id}
        status={license.status}
        expiresAt={
          license.expiresAt
            ? license.expiresAt.toISOString()
            : null
        }
      />
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>

      <p className="mt-3 break-words text-xl font-semibold text-white">
        {value}
      </p>

      <p className="mt-2 break-words text-xs text-slate-400">
        {detail}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 break-all text-sm text-slate-100 ${
          mono
            ? "font-mono"
            : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function BoundaryItem({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-amber-300/10 bg-slate-950/20 px-4 py-3 text-amber-50/90">
      {children}
    </div>
  );
}

function TransitionField({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/25 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="break-all text-slate-400">
          {before}
        </span>

        <span className="text-slate-600">-&gt;</span>

        <span className="break-all font-medium text-slate-100">
          {after}
        </span>
      </div>
    </div>
  );
}