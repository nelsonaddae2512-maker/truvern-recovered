import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safe(value: unknown) {
  return typeof value === "string" ? value : "";
}

function formatDate(value: unknown) {
  if (!value) return "Unknown";

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export default async function PublicReleaseVerificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const id = Number(resolved.id);

  if (!Number.isFinite(id) || id <= 0) {
    return notFound();
  }

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    select
      gm.id as "manifestId",
      gm.checksum,
      gm."createdAt" as "manifestCreatedAt",
      ra.id as "assignmentId",
      ra.status::text as "assignmentStatus",
      v.id as "vendorId",
      v.name as "vendorName",
      v.slug as "vendorSlug",
      v.category as "vendorCategory"
    from "GovernanceReleaseManifest" gm
    join "ReviewAssignment" ra
      on ra.id = gm."reviewAssignmentId"
    join "ReviewRequest" rr
      on rr.id = ra."reviewRequestId"
    join "Vendor" v
      on v.id = rr."vendorId"
    where gm.id = $1
    limit 1
    `,
    id,
  );

  const record = rows[0];

  if (!record) {
    return notFound();
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="border-b border-white/10 bg-gradient-to-br from-emerald-500/10 via-[#020617] to-cyan-500/10">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">
            Independent governance verification
          </div>

          <h1 className="mt-8 text-5xl font-semibold tracking-tight">
            Verified governance release
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            This page validates that a Truvern governance release manifest exists
            for the referenced vendor review record.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-500/10 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                Verification status
              </p>

              <h2 className="mt-3 text-4xl font-semibold text-white">
                Valid manifest found
              </h2>

              <p className="mt-4 max-w-3xl leading-8 text-slate-300">
                Truvern found a governance release manifest matching this
                verification reference. The checksum below identifies the
                immutable release record.
              </p>
            </div>

            <div className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-5 py-3 text-sm font-bold text-emerald-50">
              VERIFIED
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Vendor
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {safe(record.vendorName)}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {safe(record.vendorCategory) || "General vendor"}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Release status
              </p>
              <p className="mt-3 text-2xl font-semibold text-emerald-100">
                {safe(record.assignmentStatus)}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Manifest #{record.manifestId}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Immutable checksum
              </p>
              <p className="mt-3 break-all font-mono text-sm text-cyan-100">
                {safe(record.checksum)}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Manifest created
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatDate(record.manifestCreatedAt)}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Review assignment
              </p>
              <p className="mt-3 font-mono text-lg font-semibold text-white">
                #{record.assignmentId}
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            {safe(record.vendorSlug) ? (
              <Link
                href={`/trust-network/${record.vendorSlug}`}
                className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/20"
              >
                View vendor trust profile
              </Link>
            ) : null}

            <Link
              href="/trust-network"
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              Explore Trust Network
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

