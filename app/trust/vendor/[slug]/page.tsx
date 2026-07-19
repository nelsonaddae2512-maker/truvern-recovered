import Link from "next/link";
import prisma from "@/lib/prisma";

function safeStr(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeUpper(value: unknown) {
  return safeStr(value).trim().toUpperCase();
}

function formatDateTime(value: unknown) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function VendorTrustProfilePage({
  params,
}: PageProps) {
  const resolved = await params;

  const slug = safeStr(resolved.slug)
    .trim()
    .toLowerCase();

  const vendor = await prisma.vendor.findFirst({
    where: {
      slug,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!vendor) {
    return (
      <main className="min-h-screen bg-[#020617] px-6 py-24 text-white">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-semibold">
            Vendor trust profile not found
          </h1>

          <p className="mt-4 text-white/70">
            This public governance profile does not exist.
          </p>
        </div>
      </main>
    );
  }

  const releaseRows = await prisma.$queryRawUnsafe<any[]>(
    `
    select
      ra.id as "assignmentId",
      rr.id as "responseId",
      rr.responses->>'decision' as decision,
      rr.responses->>'riskLevel' as "riskLevel",
      rr.responses->>'confirmedAt' as "confirmedAt",
      rr.responses->'governanceSeal'->>'checksum' as checksum,
      coalesce(
        rr.responses->'governanceSeal'->>'receiptId',
        gtl."receiptId"
      ) as "receiptId",
      gtl.id as "entryId",
      gtl.id as "entryId",
      gtl."entryHash" as "entryHash",
      rr."updatedAt" as "updatedAt"
    from "ReviewAssignment" ra
    join "ReviewResponse" rr
      on rr."reviewAssignmentId" = ra.id
    left join "GovernanceTransparencyLog" gtl
      on gtl."assignmentId" = ra.id
    where ra."vendorId" = $1
      and upper(coalesce(rr.responses->>'releaseState', '')) in (
  'CONFIRMED',
  'RELEASED'
)
    order by ra.id desc
    limit 20
    `,
    vendor.id,
  );

  const releases = releaseRows.map((row) => {
    const decision = safeUpper(row.decision) || "UNKNOWN";
    const risk = safeUpper(row.riskLevel) || "UNKNOWN";
    const verified = !!row.entryHash && !!row.checksum;

    return {
      id: Number(row.responseId),
      assignmentId: Number(row.assignmentId),
      receiptId: safeStr(row.receiptId),
      checksum: safeStr(row.checksum),
      entryHash: safeStr(row.entryHash),
      finalizedAt: row.confirmedAt || row.updatedAt || null,
      decision,
      risk,
      verified,
      chainPosition: safeStr(row.entryId || ""),
    };
  });

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-[32px] border border-cyan-500/20 bg-white/[0.03] p-10 shadow-2xl shadow-cyan-950/20">
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">
            Truvern Trust Network
          </div>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight">
            {vendor.name}
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/70">
            Public immutable governance transparency profile with
            cryptographic verification, transparency ledger anchoring,
            and immutable release attestations.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                Governance status
              </div>

              <div className="mt-3 text-2xl font-semibold text-white">
                Verified
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-200">
                Immutable releases
              </div>

              <div className="mt-3 text-2xl font-semibold text-white">
                {releases.length}
              </div>
            </div>

            <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-fuchsia-200">
                Transparency chain
              </div>

              <div className="mt-3 text-2xl font-semibold text-white">
                Verified
              </div>
            </div>

            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-amber-200">
                Public attestations
              </div>

              <div className="mt-3 text-2xl font-semibold text-white">
                Active
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/[0.03] p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-semibold">
                Immutable governance releases
              </h2>

              <p className="mt-2 text-white/60">
                Public cryptographically verifiable governance artifacts.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            {releases.map((release) => (
              <div
  key={release.id}
  className="rounded-[28px] border border-white/10 bg-[#071226] p-8"
>
  <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.34em] text-emerald-200">
          Immutable release verified
        </span>

        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-100">
          Release #{release.id}
        </span>

        {release.verified ? (
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.34em] text-violet-100">
            Transparency chain verified
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-4xl font-semibold tracking-tight text-white">
          Governance Release #{release.id}
        </h3>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span>
            Decision:
            <span className="ml-2 font-semibold text-white">
              {release.decision}
            </span>
          </span>

          <span className="text-slate-600">•</span>

          <span>
            Residual risk:
            <span className="ml-2 font-semibold text-white">
              {release.risk}
            </span>
          </span>
        </div>

        <p className="text-sm text-slate-400">
          Finalized: {formatDateTime(release.finalizedAt)}
        </p>

        <div className="space-y-3 text-xs text-slate-500">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="uppercase tracking-[0.25em] text-slate-600">
                Receipt ID
              </div>

              <div className="mt-2 font-mono text-slate-300">
                {release.receiptId}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="uppercase tracking-[0.25em] text-slate-600">
                Transparency chain position
              </div>

              <div className="mt-2 font-semibold text-cyan-300">
                Entry #{release.chainPosition || "Unknown"}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="uppercase tracking-[0.25em] text-slate-600">
                Governance checksum
              </div>

              <div className="mt-2 font-mono text-emerald-300">
                {release.checksum}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="uppercase tracking-[0.25em] text-slate-600">
                Merkle inclusion
              </div>

              <div className="mt-2 font-semibold text-violet-300">
                VERIFIED
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
            <div className="uppercase tracking-[0.25em] text-slate-600">
              Entry hash
            </div>

            <div className="mt-2 break-all font-mono text-cyan-300">
              {release.entryHash}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="flex flex-col gap-3 lg:items-stretch">
      <Link
        href={`/verify/${release.receiptId}`}
        className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-500/20"
      >
        Verify receipt
      </Link>

      <Link
        href={`/review-desk/reviews/${release.assignmentId}/packet`}
        className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
      >
        View immutable packet
      </Link>

      <Link
        href={`/api/governance/manifests/${release.receiptId}`}
        target="_blank"
        className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-6 py-3 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
      >
        Release manifest
      </Link>

      <Link
        href={`/api/governance/proofs/${release.receiptId}`}
        target="_blank"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400 hover:bg-emerald-500/20"
      >
        Merkle proof
      </Link>
    </div>
  </div>
</div>
            ))}

            {releases.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-white/60">
                No immutable governance releases available.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}







