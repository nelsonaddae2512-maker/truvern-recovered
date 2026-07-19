import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safe(value: unknown) {
  return typeof value === "string" ? value : "";
}

function formatDate(value: unknown) {
  if (!value) return "Unknown";

  try {
    return new Date(String(value)).toLocaleDateString();
  } catch {
    return "Unknown";
  }
}

export default async function TrustNetworkVendorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolved = await params;

  const vendors: any[] = await prisma.$queryRawUnsafe(
    `
    select
      v.id,
      v.name,
      v.slug,
      v.category,
      v."updatedAt",
      count(distinct gm.id)::int as "releaseCount",
      max(gm."createdAt") as "latestReleaseAt"
    from "Vendor" v
    left join "ReviewRequest" rr
      on rr."vendorId" = v.id
    left join "ReviewAssignment" ra
      on ra."reviewRequestId" = rr.id
    left join "GovernanceReleaseManifest" gm
      on gm."reviewAssignmentId" = ra.id
    where lower(v.slug) = lower($1)
    group by v.id
    limit 1
    `,
    resolved.slug,
  );

  const vendor = vendors[0];

  if (!vendor) {
    return notFound();
  }

  const manifests: any[] = await prisma.$queryRawUnsafe(
    `
    select
      gm.id,
      gm.checksum,
      gm."createdAt",
      ra.status::text as status
    from "GovernanceReleaseManifest" gm
    join "ReviewAssignment" ra
      on ra.id = gm."reviewAssignmentId"
    join "ReviewRequest" rr
      on rr.id = ra."reviewRequestId"
    join "Vendor" v
      on v.id = rr."vendorId"
    where v.id = $1
    order by gm."createdAt" desc
    limit 10
    `,
    vendor.id,
  );

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="border-b border-white/10 bg-gradient-to-br from-cyan-500/10 via-[#020617] to-emerald-500/10">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
            Truvern Trust Network
          </div>

          <h1 className="mt-8 text-5xl font-semibold tracking-tight md:text-6xl">
            {safe(vendor.name)}
          </h1>

          <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-300">
            Public governance trust profile with immutable release verification
            history and governance release transparency.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200">
              {safe(vendor.category) || "General vendor"}
            </div>

            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
              {vendor.releaseCount || 0} governance releases
            </div>

            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
              Last verified {formatDate(vendor.latestReleaseAt)}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Governance release history
            </p>

            <h2 className="mt-3 text-3xl font-semibold">
              Immutable governance records
            </h2>
          </div>

          <Link
            href="/trust-network"
            className="text-sm font-semibold text-cyan-100 transition hover:text-white"
          >
            Back to Trust Network
          </Link>
        </div>

        <div className="mt-8 space-y-5">
          {manifests.length === 0 ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
              <h3 className="text-2xl font-semibold">
                No published governance releases
              </h3>

              <p className="mt-4 max-w-3xl leading-8 text-slate-300">
                This vendor does not currently have any publicly exposed
                governance release manifests.
              </p>
            </div>
          ) : (
            manifests.map((manifest) => (
              <article
                key={manifest.id}
                className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Governance manifest
                    </p>

                    <h3 className="mt-3 text-2xl font-semibold text-white">
                      Release #{manifest.id}
                    </h3>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                        {safe(manifest.status)}
                      </div>

                      <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                        Immutable release
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 lg:max-w-xl">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Checksum
                    </p>

                    <p className="mt-3 break-all font-mono text-sm text-cyan-100">
                      {safe(manifest.checksum)}
                    </p>

                    <p className="mt-4 text-sm text-slate-400">
                      Published {formatDate(manifest.createdAt)}
                    </p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

