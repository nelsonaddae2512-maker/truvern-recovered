import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import {
  createGovernanceSignature,
  verifyGovernanceSignature,
} from "@/lib/governance/signed-manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safe(value: unknown) {
  return typeof value === "string" ? value : "";
}

function formatDate(value: unknown) {
  if (!value) return "Unknown";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

export default async function SignedManifestVerificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const manifestId = Number(resolved.id);

  if (!Number.isFinite(manifestId)) {
    return notFound();
  }

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    select
      gm.id,
      gm.checksum,
      gm."createdAt",
      ra.id as "assignmentId",
      ra.status::text as status,
      v.name as "vendorName",
      v.slug as "vendorSlug"
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
    manifestId,
  );

  const row = rows[0];

  if (!row) {
    return notFound();
  }

  const signedManifest = createGovernanceSignature({
    manifestId: Number(row.id),
    assignmentId: Number(row.assignmentId),
    checksum: safe(row.checksum),
    issuedAt: new Date(row.createdAt).toISOString(),
    vendorName: safe(row.vendorName),
  });

  const verified = verifyGovernanceSignature(signedManifest);

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="border-b border-white/10 bg-gradient-to-br from-violet-500/10 via-[#020617] to-cyan-500/10">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100">
            Public cryptographic verification
          </div>

          <h1 className="mt-8 text-5xl font-semibold tracking-tight md:text-6xl">
            Signed governance manifest
          </h1>

          <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-300">
            Independent verification page for immutable Truvern governance
            release manifests and signed governance proofs.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
                Signature verification
              </p>

              <h2 className="mt-3 text-4xl font-semibold text-white">
                {verified ? "Signature verified" : "Verification failed"}
              </h2>

              <p className="mt-4 max-w-3xl leading-8 text-slate-300">
                Truvern validated the integrity of this signed governance
                manifest using the registered governance signing workflow.
              </p>
            </div>

            <div
              className={[
                "rounded-full px-5 py-3 text-sm font-bold",
                verified
                  ? "border border-emerald-300/30 bg-emerald-300/15 text-emerald-50"
                  : "border border-rose-300/30 bg-rose-300/15 text-rose-50",
              ].join(" ")}
            >
              {verified ? "VERIFIED" : "INVALID"}
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Vendor
              </p>

              <p className="mt-3 text-2xl font-semibold text-white">
                {safe(row.vendorName)}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Governance status
              </p>

              <p className="mt-3 text-2xl font-semibold text-emerald-100">
                {safe(row.status)}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Immutable checksum
              </p>

              <p className="mt-3 break-all font-mono text-sm text-cyan-100">
                {safe(row.checksum)}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Cryptographic signature
              </p>

              <p className="mt-3 break-all font-mono text-xs text-violet-100">
                {signedManifest.signature}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Algorithm
              </p>

              <p className="mt-3 text-lg font-semibold text-white">
                {signedManifest.algorithm}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Public key fingerprint
              </p>

              <p className="mt-3 break-all font-mono text-xs text-cyan-100">
                {signedManifest.publicKeyFingerprint}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Issued
              </p>

              <p className="mt-3 text-lg font-semibold text-white">
                {formatDate(row.createdAt)}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Assignment reference
              </p>

              <p className="mt-3 font-mono text-lg font-semibold text-white">
                #{row.assignmentId}
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <p className="text-sm leading-8 text-slate-200">
              This verification confirms that the governance manifest payload
              has not been modified since issuance and that the release was
              generated through Truvern governance signing infrastructure.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/api/governance/signed-manifest/${manifestId}`}
              target="_blank"
              className="rounded-2xl border border-violet-300/30 bg-violet-300/15 px-5 py-3 text-sm font-semibold text-violet-50 transition hover:bg-violet-300/20"
            >
              Download signed manifest
            </Link>

            {safe(row.vendorSlug) ? (
              <Link
                href={`/trust-network/${row.vendorSlug}`}
                className="rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/20"
              >
                Vendor trust profile
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

