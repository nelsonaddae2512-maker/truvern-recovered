import Link from "next/link";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function safeStr(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function getEntries() {
  const rows: any[] = await prisma.$queryRawUnsafe(`
    select
      id,
      "receiptId",
      "assignmentId",
      "responseId",
      checksum,
      "entryHash",
      "previousEntryHash",
      timestamp,
      "createdAt"
    from "GovernanceTransparencyLog"
    order by id desc
    limit 100
  `);

  return rows;
}

export default async function TransparencyChainPage() {
  const entries = await getEntries();

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10">
          <div className="mb-3 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Truvern Transparency Chain
          </div>

          <h1 className="text-5xl font-semibold tracking-tight">
            Immutable Governance Ledger
          </h1>

          <p className="mt-4 max-w-3xl text-base text-slate-400">
            Public transparency explorer for notarized Truvern governance
            releases, immutable manifests, cryptographic attestations, and
            chain-linked release verification.
          </p>
        </div>

        <div className="grid gap-6">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-cyan-950/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                      VERIFIED
                    </div>

                    <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                      ENTRY #{entry.id}
                    </div>
                  </div>

                  <h2 className="text-2xl font-semibold text-white">
                    {safeStr(entry.receiptId) || "Unnotarized Entry"}
                  </h2>

                  <div className="mt-3 grid gap-2 text-sm text-slate-400">
                    <div>
                      Assignment #{entry.assignmentId} • Response #
                      {entry.responseId}
                    </div>

                    <div>
                      Timestamp:{" "}
                      {entry.timestamp
                        ? new Date(entry.timestamp).toLocaleString()
                        : "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/verify/${encodeURIComponent(
                      safeStr(entry.receiptId),
                    )}`}
                    className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
                  >
                    Verify receipt
                  </Link>

                  <Link
                    href={`/api/governance/manifests/${encodeURIComponent(
                      safeStr(entry.receiptId),
                    )}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Release manifest
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Checksum
                  </div>

                  <div className="break-all font-mono text-sm text-emerald-300">
                    {safeStr(entry.checksum)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Entry Hash
                  </div>

                  <div className="break-all font-mono text-sm text-cyan-300">
                    {safeStr(entry.entryHash)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Previous Hash
                  </div>

                  <div className="break-all font-mono text-sm text-violet-300">
                    {safeStr(entry.previousEntryHash) || "Genesis entry"}
                  </div>
                </div>
              </div>

              {index !== entries.length - 1 && (
                <div className="mt-6 flex items-center gap-3 text-cyan-500">
                  <div className="h-10 w-px bg-cyan-500/30" />
                  <div className="text-xs uppercase tracking-[0.3em]">
                    Chain-linked immutable governance record
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}


