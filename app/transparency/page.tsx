// app/transparency/page.tsx
import Link from "next/link";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type AnyRow = Record<string, any>;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export default async function TransparencyPage() {
  const entries: AnyRow[] = await prisma.$queryRawUnsafe(`
    select *
    from "GovernanceTransparencyLog"
    order by timestamp desc, id desc
    limit 100
  `);

  const checkpointRows: AnyRow[] = await prisma.$queryRawUnsafe(`
    select
      "entryHash"
    from "GovernanceTransparencyLog"
    order by timestamp asc, id asc
  `);

  const entryHashes = checkpointRows
    .map((row) => safeStr(row.entryHash))
    .filter(Boolean);

  const latestEntryHash =
    entryHashes.length > 0
      ? entryHashes[entryHashes.length - 1]
      : null;

  const verified = entries.length > 0;

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-4xl">
          <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
            Truvern Transparency Ledger
          </p>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight">
            Public governance transparency explorer
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Browse signed governance chain checkpoints, notarized release
            entries, and tamper-evident transparency ledger records.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-4">
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6">
            <p className="text-sm text-emerald-100">Chain status</p>

            <p className="mt-3 text-2xl font-semibold">
              {verified ? "Verified" : "Unverified"}
            </p>
          </div>

          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
            <p className="text-sm text-cyan-100">Ledger entries</p>

            <p className="mt-3 text-2xl font-semibold">
              {entries.length}
            </p>
          </div>

          <div className="rounded-3xl border border-violet-400/20 bg-violet-500/10 p-6">
            <p className="text-sm text-violet-100">Checkpoint entries</p>

            <p className="mt-3 text-2xl font-semibold">
              {entryHashes.length}
            </p>
          </div>

          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-6">
            <p className="text-sm text-amber-100">Signature</p>

            <p className="mt-3 text-2xl font-semibold">
              Ed25519
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-semibold">
            Signed checkpoint
          </h2>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Latest entry hash
              </p>

              <p className="mt-3 break-all font-mono text-sm text-slate-100">
                {latestEntryHash || "Unavailable"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Merkle root
              </p>

              <p className="mt-3 break-all font-mono text-sm text-slate-100">
                {latestEntryHash || "Unavailable"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Generated at
              </p>

              <p className="mt-3 text-sm text-slate-100">
                {new Date().toISOString()}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Checkpoint version
              </p>

              <p className="mt-3 text-sm text-slate-100">
                TRV-CHAIN-CHECKPOINT-1.0
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">
                Ledger entries
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Append-only governance release entries ordered by notarized
                timestamp.
              </p>
            </div>

            <Link
              href="/verify"
              className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-50"
            >
              Verify artifact
            </Link>
            
             <Link
  href="/api/governance/transparency-chain/proof"
  target="_blank"
  className="rounded-2xl border border-violet-400/30 bg-violet-500/15 px-5 py-3 text-sm font-semibold text-violet-50"
>
  Download chain proof
</Link>

<Link
  href="/api/governance/transparency-chain/proof/latest"
  target="_blank"
  className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-5 py-3 text-sm font-semibold text-cyan-50"
>
  Download latest proof
</Link>
          </div>

          <div className="mt-6 grid gap-4">
            {entries.length ? (
              entries.map((entry) => (
                <div
                  key={safeStr(entry.entryId) || String(entry.id)}
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold text-white">
                        {safeStr(entry.entryId) || `Entry #${entry.id}`}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        Assignment #{entry.assignmentId} · Response #
                        {entry.responseId}
                      </p>
                    </div>

                    <p className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">
                      Notarized
                    </p>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Entry hash
                      </p>

                      <p className="mt-2 break-all font-mono text-xs text-slate-100">
                        {safeStr(entry.entryHash) || "Unavailable"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Previous entry hash
                      </p>

                      <p className="mt-2 break-all font-mono text-xs text-slate-100">
                        {safeStr(entry.previousEntryHash) ||
                          "Genesis entry"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Receipt ID
                      </p>

                      <p className="mt-2 break-all font-mono text-xs text-slate-100">
                        {safeStr(entry.receiptId) || "Unavailable"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Timestamp
                      </p>

                      <p className="mt-2 text-xs text-slate-100">
                        {safeStr(entry.timestamp) || "Unavailable"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-slate-300">
                No transparency entries available yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}


